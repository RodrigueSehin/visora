// Browser-side import pipeline: parse → inspect → (optionally optimise) → convert to a
// self-contained GLB so the library stores one file per asset regardless of source format.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { getGltfLoader, withTimeout } from '../three/assetCache';
import {
  checkSignature,
  checkSize,
  extOf,
  heavyWarnings,
  pickMainFile,
  suggestUnitScale,
  type ImportIssue,
  type SupportedFormat,
} from './importValidation';

const PARSE_TIMEOUT_MS = 45_000;

export type ModelStats = {
  meshes: number;
  triangles: number;
  materials: number;
  textures: number;
  maxTexture: number;
  size: { x: number; y: number; z: number };
};

export type ImportAnalysis = {
  ok: boolean;
  fileName: string;
  format?: SupportedFormat;
  bytes: number;
  issues: ImportIssue[];
  object?: THREE.Object3D;
  stats?: ModelStats;
  suggestedUnitScale: number;
  unitReason?: string;
};

export function computeStats(root: THREE.Object3D): ModelStats {
  let meshes = 0;
  let triangles = 0;
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    triangles += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      materials.add(mat);
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
    }
  });
  let maxTexture = 0;
  for (const t of textures) {
    const img = t.image as { width?: number; height?: number } | undefined;
    if (img?.width) maxTexture = Math.max(maxTexture, img.width, img.height ?? 0);
  }
  const s = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return {
    meshes,
    triangles: Math.round(triangles),
    materials: materials.size,
    textures: textures.size,
    maxTexture,
    size: { x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3) },
  };
}

/** Builds a loading manager resolving sibling files (textures, .bin, .mtl) to blob URLs. */
function siblingManager(files: File[], missing: Set<string>) {
  const urls = new Map<string, string>();
  for (const f of files) urls.set(f.name.toLowerCase(), URL.createObjectURL(f));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const base = decodeURIComponent(url.split(/[\\/]/).pop() ?? url).toLowerCase();
    const hit = urls.get(base);
    if (!hit) missing.add(base);
    return hit ?? url;
  });
  manager.onError = (url) => missing.add(decodeURIComponent(url.split(/[\\/]/).pop() ?? url));
  return { manager, revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

async function parse(format: SupportedFormat, main: File, files: File[], missing: Set<string>): Promise<THREE.Object3D> {
  const { manager, revoke } = siblingManager(files, missing);
  try {
    switch (format) {
      case 'glb':
      case 'gltf': {
        const data = format === 'glb' ? await main.arrayBuffer() : await main.text();
        const gltf = await getGltfLoader(manager).parseAsync(data, '');
        return gltf.scene;
      }
      case 'obj': {
        const text = await main.text();
        const loader = new OBJLoader(manager);
        const mtlName = text.match(/^\s*mtllib\s+(.+)$/m)?.[1]?.trim();
        const mtlFile = mtlName && files.find((f) => f.name.toLowerCase() === mtlName.split(/[\\/]/).pop()!.toLowerCase());
        if (mtlFile) {
          const mtl = new MTLLoader(manager).parse(await mtlFile.text(), '');
          mtl.preload();
          loader.setMaterials(mtl);
        } else if (mtlName) missing.add(mtlName);
        return loader.parse(text);
      }
      case 'fbx':
        return new FBXLoader(manager).parse(await main.arrayBuffer(), '');
      case 'stl': {
        const geom = new STLLoader(manager).parse(await main.arrayBuffer());
        geom.computeVertexNormals();
        const hasColors = !!geom.getAttribute('color');
        const mesh = new THREE.Mesh(
          geom,
          new THREE.MeshStandardMaterial({ color: hasColors ? 0xffffff : 0xb8c2d0, vertexColors: hasColors, roughness: 0.6, metalness: 0.1 }),
        );
        // STL is usually Z-up.
        mesh.rotation.x = -Math.PI / 2;
        const g = new THREE.Group();
        g.add(mesh);
        return g;
      }
    }
  } finally {
    // Give texture loads queued by the parser a moment before revoking blob URLs.
    setTimeout(revoke, 15_000);
  }
}

/** Waits for textures referenced by the model to finish decoding. */
async function waitForTextures(root: THREE.Object3D, timeoutMs = 10_000) {
  const pending: Promise<void>[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material])
      for (const v of Object.values(mat))
        if (v instanceof THREE.Texture && !v.image) {
          pending.push(new Promise<void>((res) => {
            const start = Date.now();
            const tick = () => (v.image || Date.now() - start > timeoutMs ? res() : setTimeout(tick, 100));
            tick();
          }));
        }
  });
  await Promise.all(pending);
}

export async function analyzeFiles(files: File[]): Promise<ImportAnalysis> {
  const { main, issues } = pickMainFile(files);
  const base: ImportAnalysis = { ok: false, fileName: main?.name ?? files[0]?.name ?? '', bytes: main?.size ?? 0, issues, suggestedUnitScale: 1 };
  if (!main) return base;
  const format = extOf(main.name) as SupportedFormat;
  base.format = format;
  issues.push(...checkSize(main.size));
  if (issues.some((i) => i.level === 'error')) return base;
  const head = new Uint8Array(await main.slice(0, 512).arrayBuffer());
  issues.push(...checkSignature(format, head));
  if (issues.some((i) => i.level === 'error')) return base;

  const missing = new Set<string>();
  let object: THREE.Object3D;
  try {
    object = await withTimeout(parse(format, main, files, missing), PARSE_TIMEOUT_MS, 'timeout');
    await waitForTextures(object);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    issues.push(
      msg === 'timeout'
        ? { level: 'error', code: 'timeout', message: 'Temps de chargement dépassé (45 s). Le fichier est peut-être trop complexe.' }
        : { level: 'error', code: 'parse-error', message: `Erreur de lecture du modèle : ${msg}` },
    );
    return base;
  }
  const stats = computeStats(object);
  if (stats.meshes === 0) {
    issues.push({ level: 'error', code: 'empty', message: 'Le fichier ne contient aucune géométrie affichable.' });
    return base;
  }
  if (missing.size)
    issues.push({
      level: 'warning',
      code: 'missing-textures',
      message: `Ressources manquantes : ${[...missing].slice(0, 5).join(', ')}${missing.size > 5 ? '…' : ''}. Ajoutez-les à la sélection ou poursuivez sans.`,
    });
  issues.push(...heavyWarnings(stats));
  const { scale, reason } = suggestUnitScale(Math.max(stats.size.x, stats.size.y, stats.size.z));
  return { ...base, ok: true, object, stats, suggestedUnitScale: scale, unitReason: reason };
}

/** Downscales textures above `maxSize` in place. Returns how many were resized. */
export function downscaleTextures(root: THREE.Object3D, maxSize = 1024): number {
  const done = new Set<THREE.Texture>();
  let count = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material])
      for (const v of Object.values(mat)) {
        if (!(v instanceof THREE.Texture) || done.has(v)) continue;
        done.add(v);
        const img = v.image as CanvasImageSource & { width: number; height: number };
        if (!img?.width || Math.max(img.width, img.height) <= maxSize) continue;
        const k = maxSize / Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * k));
        canvas.height = Math.max(1, Math.round(img.height * k));
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        v.image = canvas;
        v.needsUpdate = true;
        count++;
      }
  });
  return count;
}

export async function exportGlb(root: THREE.Object3D): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const out = await exporter.parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 4096 });
  if (!(out instanceof ArrayBuffer)) throw new Error('Conversion GLB impossible.');
  return out;
}
