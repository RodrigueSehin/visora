// Loads asset models once and hands out lightweight clones per instance.
// Imported files are ref-counted: when no instance uses a file any more (deleted objects,
// scene change), its GPU resources are disposed after a grace period.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getFile } from '../services/persistence';
import type { Asset3D, ObjectStyle } from '../types';
import { buildBuiltin } from './procedural';

const LOAD_TIMEOUT_MS = 45_000;
const DISPOSE_DELAY_MS = 30_000;

let gltfLoader: GLTFLoader | undefined;
export function getGltfLoader(manager?: THREE.LoadingManager): GLTFLoader {
  const make = (m?: THREE.LoadingManager) => {
    const l = new GLTFLoader(m);
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    l.setDRACOLoader(draco);
    l.setMeshoptDecoder(MeshoptDecoder);
    return l;
  };
  if (manager) return make(manager);
  return (gltfLoader ??= make());
}

// In-flight file loads, observed by the viewport loading indicator.
let pending = 0;
const pendingListeners = new Set<(n: number) => void>();
const setPending = (d: number) => {
  pending = Math.max(0, pending + d);
  pendingListeners.forEach((l) => l(pending));
};
export function onPendingLoads(cb: (n: number) => void) {
  pendingListeners.add(cb);
  cb(pending);
  return () => void pendingListeners.delete(cb);
}

type Entry = { promise: Promise<THREE.Object3D>; refs: number; timer?: ReturnType<typeof setTimeout>; root?: THREE.Object3D };
const files = new Map<string, Entry>();

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function markShared(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.userData.shared = true;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.userData.shared = true;
  });
}

async function loadFileRoot(fileId: string): Promise<THREE.Object3D> {
  const blob = await getFile(fileId);
  if (!blob) throw new Error('Fichier source introuvable dans le stockage local.');
  const buf = await blob.arrayBuffer();
  const gltf = await withTimeout(getGltfLoader().parseAsync(buf, ''), LOAD_TIMEOUT_MS, 'Temps de chargement dépassé.');
  const root = gltf.scene;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  markShared(root);
  return root;
}

export function disposeObject(root: THREE.Object3D, includeShared = false) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (includeShared || !m.geometry.userData.shared) m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!includeShared && mat.userData.shared) continue;
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

/** Acquire an instance of an asset. Call `release` when the instance unmounts. */
export async function acquireInstance(asset: Asset3D): Promise<THREE.Object3D> {
  if (asset.source.kind === 'builtin') return buildBuiltin(asset.source.key);
  const id = asset.source.fileId;
  let e = files.get(id);
  if (!e) {
    setPending(1);
    const promise = loadFileRoot(id);
    promise.finally(() => setPending(-1)).catch(() => {});
    e = { promise, refs: 0 };
    files.set(id, e);
    e.promise.then((r) => (e!.root = r)).catch(() => files.delete(id));
  }
  if (e.timer) {
    clearTimeout(e.timer);
    e.timer = undefined;
  }
  e.refs++;
  try {
    const root = await e.promise;
    const inst = skeletonClone(root);
    if (asset.unitScale && asset.unitScale !== 1) {
      const wrap = new THREE.Group();
      inst.scale.multiplyScalar(asset.unitScale);
      wrap.add(inst);
      return wrap;
    }
    return inst;
  } catch (err) {
    e.refs--;
    throw err;
  }
}

export function releaseInstance(asset: Asset3D, inst?: THREE.Object3D) {
  if (inst) disposeObject(inst, false);
  if (asset.source.kind !== 'file') return;
  const id = asset.source.fileId;
  const e = files.get(id);
  if (!e) return;
  e.refs = Math.max(0, e.refs - 1);
  if (e.refs === 0) {
    e.timer = setTimeout(() => {
      if (e.refs === 0) {
        if (e.root) disposeObject(e.root, true);
        files.delete(id);
      }
    }, DISPOSE_DELAY_MS);
  }
}

/** Drops a cached file immediately (used when an asset file is replaced). */
export function evictFile(fileId: string) {
  const e = files.get(fileId);
  if (e?.root) disposeObject(e.root, true);
  files.delete(fileId);
}

export function cacheStats() {
  return { files: files.size, refs: [...files.values()].reduce((a, e) => a + e.refs, 0) };
}

const ORIGINAL = 'visoraOriginalMaterial';

/** Applies per-instance style overrides by cloning materials (originals stay shared). */
export function applyInstanceStyle(root: THREE.Object3D, style: ObjectStyle | undefined, cast: boolean, receive: boolean) {
  const has = !!style && Object.values(style).some((v) => v !== undefined && v !== '');
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = cast;
    m.receiveShadow = receive;
    const original = (m.userData[ORIGINAL] as THREE.Material | THREE.Material[] | undefined) ?? m.material;
    if (!has) {
      if (m.userData[ORIGINAL]) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (!mat.userData.shared) mat.dispose();
        m.material = original;
        delete m.userData[ORIGINAL];
      }
      return;
    }
    if (!m.userData[ORIGINAL]) {
      m.userData[ORIGINAL] = original;
      m.material = Array.isArray(original) ? original.map((x) => x.clone()) : original.clone();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.userData.shared = false;
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const origs = Array.isArray(original) ? original : [original];
    mats.forEach((mat, i) => {
      const src = origs[i] as THREE.MeshStandardMaterial;
      const sm = mat as THREE.MeshStandardMaterial;
      if ('color' in sm && sm.color) sm.color.set(style!.color ? style!.color : src.color);
      if ('roughness' in sm) sm.roughness = style!.roughness ?? src.roughness;
      if ('metalness' in sm) sm.metalness = style!.metalness ?? src.metalness;
      if ('emissive' in sm && sm.emissive) {
        sm.emissive.set(style!.emissive ? style!.emissive : src.emissive);
        sm.emissiveIntensity = style!.emissive ? style!.emissiveIntensity ?? 1 : src.emissiveIntensity;
      }
      const opacity = style!.opacity ?? src.opacity;
      sm.opacity = opacity;
      sm.transparent = opacity < 1 || src.transparent;
      sm.depthWrite = opacity >= 1 ? src.depthWrite : false;
      sm.needsUpdate = true;
    });
  });
}

/** True when the materials support PBR controls (roughness/metalness). */
export function supportsPbr(root: THREE.Object3D): boolean {
  let ok = false;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) ok = true;
  });
  return ok;
}
