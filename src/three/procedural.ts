// Built-in VISORA assets, generated procedurally from primitives.
// Geometries and materials are cached and shared by every instance (cheap memory,
// GPU buffers uploaded once). Per-instance style overrides clone materials on demand.
import * as THREE from 'three';
import type { AssetCategory, Vec3 } from '../types';

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

function mat(color: string, opts: { r?: number; m?: number; e?: string; t?: number } = {}) {
  const key = `${color}|${opts.r ?? 0.7}|${opts.m ?? 0}|${opts.e ?? ''}|${opts.t ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.r ?? 0.7,
      metalness: opts.m ?? 0,
      emissive: opts.e ? new THREE.Color(opts.e) : new THREE.Color(0x000000),
      emissiveIntensity: opts.e ? 1.2 : 0,
      transparent: (opts.t ?? 1) < 1,
      opacity: opts.t ?? 1,
    });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}

type M = THREE.Material;
const BOX = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const CYL = (rt: number, rb: number, h: number, s = 20) =>
  geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const SPH = (r: number) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const CONE = (r: number, h: number) => geo(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 24));
const TOR = (r: number, t: number) => geo(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 10, 24));

function add(parent: THREE.Object3D, g: THREE.BufferGeometry, m: M, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, m: M, x = 0, y = 0, z = 0, ry = 0) =>
  add(p, BOX(w, h, d), m, x, y, z, 0, ry, 0);
const cyl = (p: THREE.Object3D, r: number, h: number, m: M, x = 0, y = 0, z = 0, rx = 0, rz = 0, rTop?: number) =>
  add(p, CYL(rTop ?? r, r, h), m, x, y, z, rx, 0, rz);
const wheel = (p: THREE.Object3D, r: number, w: number, x: number, y: number, z: number) =>
  cyl(p, r, w, C.rubber, x, y, z, 0, Math.PI / 2);

const C = {
  get yellow() { return mat('#F2B705', { r: 0.45, m: 0.2 }); },
  get black() { return mat('#1d2129', { r: 0.6 }); },
  get rubber() { return mat('#16181d', { r: 0.95 }); },
  get steel() { return mat('#9aa6b5', { r: 0.35, m: 0.85 }); },
  get blue() { return mat('#1f5fbf', { r: 0.45, m: 0.4 }); },
  get orange() { return mat('#ef6b1f', { r: 0.5, m: 0.3 }); },
  get wood() { return mat('#b98a55', { r: 0.85 }); },
  get carton() { return mat('#c8995e', { r: 0.9 }); },
  get white() { return mat('#e9edf2', { r: 0.6 }); },
  get grey() { return mat('#5c6675', { r: 0.6, m: 0.2 }); },
  get dark() { return mat('#2b3240', { r: 0.5, m: 0.3 }); },
  get red() { return mat('#d52b2b', { r: 0.45, m: 0.2 }); },
  get green() { return mat('#2f9e57', { r: 0.7 }); },
  get leaf() { return mat('#3f8f3a', { r: 0.8 }); },
  get glass() { return mat('#9fd8ff', { r: 0.1, m: 0.1, t: 0.35 }); },
  get light() { return mat('#ffffff', { e: '#fff6dd' }); },
  get fabric() { return mat('#3b4a66', { r: 0.95 }); },
  get container() { return mat('#2a6fdb', { r: 0.55, m: 0.5 }); },
  get exitGreen() { return mat('#18a558', { e: '#0f6b38' }); },
};

type Builder = (g: THREE.Group) => void;

export type BuiltinDef = {
  key: string;
  name: string;
  category: AssetCategory;
  tags: string[];
  build: Builder;
};

const forklift: Builder = (g) => {
  box(g, 1.1, 0.55, 1.9, C.yellow, 0, 0.55, 0.15);
  box(g, 1.0, 0.45, 0.6, C.dark, 0, 0.62, 0.85);
  box(g, 0.6, 0.12, 0.5, C.black, 0, 0.92, 0.25);
  box(g, 0.55, 0.5, 0.1, C.black, 0, 1.15, 0.5);
  for (const x of [-0.5, 0.5]) for (const z of [-0.55, 0.85]) box(g, 0.06, 1.25, 0.06, C.black, x, 1.45, z);
  box(g, 1.1, 0.06, 1.5, C.black, 0, 2.1, 0.15);
  for (const x of [-0.35, 0.35]) box(g, 0.08, 2.2, 0.08, C.steel, x, 1.1, -0.9);
  box(g, 0.8, 0.08, 0.08, C.steel, 0, 2.15, -0.9);
  box(g, 0.8, 0.5, 0.05, C.black, 0, 0.45, -0.95);
  for (const x of [-0.25, 0.25]) box(g, 0.12, 0.05, 1.1, C.steel, x, 0.2, -1.5);
  for (const x of [-0.55, 0.55]) {
    wheel(g, 0.3, 0.25, x, 0.3, -0.45);
    wheel(g, 0.24, 0.22, x, 0.24, 0.8);
  }
};

const rack: Builder = (g) => {
  const W = 2.7, D = 1.1, H = 4.5;
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) box(g, 0.08, H, 0.08, C.blue, x, H / 2, z);
  for (const y of [0.15, 1.6, 3.05]) {
    for (const z of [-D / 2, D / 2]) box(g, W, 0.12, 0.06, C.orange, 0, y, z);
    box(g, W, 0.03, D, C.wood, 0, y + 0.07, 0);
    for (const x of [-0.65, 0.65]) {
      box(g, 1.15, 0.14, 1.0, C.wood, x, y + 0.16, 0);
      box(g, 1.05, 0.8, 0.95, C.carton, x, y + 0.63, 0);
    }
  }
  for (const x of [-W / 2, W / 2]) for (let y = 0.4; y < H; y += 0.8) box(g, 0.04, 0.04, D, C.blue, x, y, 0);
};

const pallet: Builder = (g) => {
  for (const z of [-0.5, 0, 0.5]) box(g, 1.2, 0.1, 0.1, C.wood, 0, 0.05, z);
  for (const x of [-0.55, 0, 0.55]) for (const z of [-0.5, 0, 0.5]) box(g, 0.14, 0.04, 0.14, C.wood, x, 0.12, z);
  for (let i = 0; i < 7; i++) box(g, 0.13, 0.02, 1.2, C.wood, -0.53 + i * 0.177, 0.15, 0);
};

const palletJack: Builder = (g) => {
  for (const x of [-0.27, 0.27]) box(g, 0.16, 0.08, 1.15, C.red, x, 0.08, -0.35);
  box(g, 0.7, 0.3, 0.25, C.red, 0, 0.22, 0.3);
  box(g, 0.12, 0.35, 0.12, C.dark, 0, 0.5, 0.35);
  cyl(g, 0.025, 1.1, C.black, 0, 1.0, 0.55, -0.35);
  add(g, TOR(0.12, 0.025), C.black, 0, 1.52, 0.75, Math.PI / 2 - 0.35);
  wheel(g, 0.1, 0.1, 0, 0.1, 0.35);
  for (const x of [-0.27, 0.27]) wheel(g, 0.05, 0.08, x, 0.05, -0.85);
};

const conveyor: Builder = (g) => {
  const L = 4;
  box(g, 0.9, 0.06, L, C.dark, 0, 0.82, 0);
  for (let z = -L / 2 + 0.15; z < L / 2; z += 0.25) cyl(g, 0.04, 0.85, C.steel, 0, 0.79, z, 0, Math.PI / 2);
  for (const x of [-0.47, 0.47]) box(g, 0.05, 0.16, L, C.yellow, x, 0.86, 0);
  for (const z of [-L / 2 + 0.2, 0, L / 2 - 0.2]) for (const x of [-0.4, 0.4]) box(g, 0.06, 0.78, 0.06, C.grey, x, 0.39, z);
  box(g, 0.5, 0.35, 0.4, C.carton, 0, 1.03, -0.8);
  box(g, 0.4, 0.3, 0.4, C.carton, 0, 1.0, 0.9);
};

const machine: Builder = (g) => {
  box(g, 2.2, 1.6, 1.4, C.white, 0, 0.8, 0);
  box(g, 2.25, 0.15, 1.45, C.dark, 0, 0.075, 0);
  box(g, 1.2, 0.7, 0.05, C.glass, -0.3, 1.0, 0.72);
  box(g, 0.45, 0.8, 0.1, C.dark, 0.8, 1.15, 0.72);
  box(g, 0.35, 0.25, 0.02, mat('#36C8F4', { e: '#1b6f8a' }), 0.8, 1.3, 0.78);
  add(g, SPH(0.04), C.red, 0.7, 0.95, 0.78);
  add(g, SPH(0.04), C.green, 0.9, 0.95, 0.78);
  box(g, 0.6, 0.4, 0.6, C.grey, -0.5, 1.8, -0.2);
  cyl(g, 0.06, 0.6, C.red, 1.05, 1.9, -0.5);
  add(g, SPH(0.08), C.orange, 1.05, 2.25, -0.5);
};

const container: Builder = (g) => {
  const L = 6.06, W = 2.44, H = 2.59;
  box(g, W, H, L, C.container, 0, H / 2, 0);
  for (let z = -L / 2 + 0.2; z < L / 2; z += 0.3) for (const x of [-W / 2, W / 2]) box(g, 0.04, H - 0.2, 0.12, C.container, x, H / 2, z);
  box(g, W - 0.1, H - 0.15, 0.04, mat('#2462c4', { r: 0.5, m: 0.5 }), 0, H / 2, L / 2 + 0.01);
  for (const x of [-0.4, -0.15, 0.15, 0.4]) cyl(g, 0.02, H - 0.3, C.steel, x, H / 2, L / 2 + 0.05);
  for (const x of [-W / 2, W / 2]) for (const z of [-L / 2, L / 2]) for (const y of [0.08, H - 0.08]) box(g, 0.18, 0.16, 0.18, C.dark, x, y, z);
};

const carton: Builder = (g) => {
  box(g, 0.6, 0.45, 0.4, C.carton, 0, 0.225, 0);
  box(g, 0.61, 0.04, 0.08, mat('#a77a46', { r: 0.6 }), 0, 0.45, 0);
  box(g, 0.2, 0.12, 0.005, C.white, 0.12, 0.28, 0.2);
};

const loadingDock: Builder = (g) => {
  box(g, 3.2, 1.2, 1.2, C.grey, 0, 0.6, 0);
  box(g, 2.2, 0.08, 1.4, C.steel, 0, 1.2, 0.5, 0);
  for (const x of [-1.4, 1.4]) box(g, 0.25, 0.35, 0.15, C.black, x, 0.9, 0.65);
  for (let i = 0; i < 6; i++) box(g, 0.55, 0.12, 0.02, i % 2 ? C.yellow : C.black, -1.375 + i * 0.55, 0.15, 0.61);
  box(g, 3.4, 3.2, 0.12, C.dark, 0, 1.6 + 1.2, -0.6);
  box(g, 2.8, 2.6, 0.04, mat('#8892a3', { r: 0.4, m: 0.6 }), 0, 2.6, -0.52);
};

const handlingCart: Builder = (g) => {
  box(g, 0.8, 0.04, 1.2, C.steel, 0, 0.3, 0);
  box(g, 0.8, 0.04, 1.2, C.steel, 0, 0.85, 0);
  for (const x of [-0.38, 0.38]) for (const z of [-0.58, 0.58]) cyl(g, 0.02, 0.9, C.steel, x, 0.6, z);
  cyl(g, 0.02, 0.76, C.blue, 0, 1.05, 0.62, 0, Math.PI / 2);
  for (const x of [-0.34, 0.34]) for (const z of [-0.5, 0.5]) wheel(g, 0.08, 0.05, x, 0.08, z);
  box(g, 0.5, 0.35, 0.4, C.carton, 0, 0.5, 0.2);
};

const desk: Builder = (g) => {
  box(g, 1.6, 0.04, 0.8, C.white, 0, 0.74, 0);
  for (const x of [-0.75, 0.75]) box(g, 0.05, 0.72, 0.7, C.dark, x, 0.36, 0);
  box(g, 1.4, 0.3, 0.02, C.dark, 0, 0.55, -0.36);
  box(g, 0.55, 0.35, 0.03, C.black, 0, 1.0, -0.2);
  box(g, 0.05, 0.15, 0.05, C.black, 0, 0.8, -0.2);
  box(g, 0.45, 0.02, 0.15, C.grey, 0, 0.77, 0.15);
};

const chair: Builder = (g) => {
  box(g, 0.5, 0.08, 0.48, C.fabric, 0, 0.48, 0);
  box(g, 0.48, 0.55, 0.06, C.fabric, 0, 0.82, -0.24);
  cyl(g, 0.03, 0.35, C.steel, 0, 0.27, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    box(g, 0.32, 0.03, 0.05, C.dark, Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16, -a);
    add(g, SPH(0.03), C.black, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
  }
  for (const x of [-0.27, 0.27]) box(g, 0.05, 0.04, 0.32, C.dark, x, 0.68, 0);
};

const meetingTable: Builder = (g) => {
  box(g, 3, 0.05, 1.2, C.wood, 0, 0.75, 0);
  for (const x of [-1.1, 1.1]) box(g, 0.1, 0.72, 0.8, C.dark, x, 0.37, 0);
  box(g, 2.2, 0.08, 0.08, C.dark, 0, 0.3, 0);
};

const cabinet: Builder = (g) => {
  box(g, 0.9, 1.9, 0.45, mat('#c4ccd6', { r: 0.4, m: 0.6 }), 0, 0.95, 0);
  box(g, 0.005, 1.8, 0.005, C.dark, 0, 0.95, 0.226);
  for (const x of [-0.06, 0.06]) box(g, 0.02, 0.18, 0.03, C.dark, x, 1.0, 0.24);
  box(g, 0.2, 0.05, 0.01, C.white, -0.22, 1.6, 0.23);
};

const sofa: Builder = (g) => {
  box(g, 2, 0.4, 0.9, C.fabric, 0, 0.3, 0);
  box(g, 2, 0.5, 0.2, C.fabric, 0, 0.7, -0.35);
  for (const x of [-0.95, 0.95]) box(g, 0.2, 0.55, 0.9, C.fabric, x, 0.45, 0);
  for (const x of [-0.45, 0.45]) box(g, 0.85, 0.12, 0.7, mat('#4a5b7d', { r: 0.95 }), x, 0.56, 0.05);
  for (const x of [-0.9, 0.9]) for (const z of [-0.38, 0.38]) cyl(g, 0.03, 0.1, C.black, x, 0.05, z);
};

const shelf: Builder = (g) => {
  for (const x of [-0.6, 0.6]) box(g, 0.03, 2, 0.4, C.wood, x, 1, 0);
  for (const y of [0.05, 0.5, 0.95, 1.4, 1.95]) box(g, 1.2, 0.03, 0.4, C.wood, 0, y, 0);
  box(g, 1.2, 2, 0.01, mat('#a07445', { r: 0.9 }), 0, 1, -0.2);
  box(g, 0.3, 0.3, 0.3, C.carton, -0.35, 0.67, 0);
  box(g, 0.25, 0.32, 0.25, C.blue, 0.3, 1.12, 0);
};

const counter: Builder = (g) => {
  box(g, 2.4, 1.05, 0.7, C.white, 0, 0.525, 0);
  box(g, 2.5, 0.05, 0.8, C.wood, 0, 1.075, 0);
  box(g, 2.4, 0.1, 0.02, mat('#36C8F4', { e: '#1b6f8a' }), 0, 0.2, 0.36);
};

const cone: Builder = (g) => {
  box(g, 0.38, 0.03, 0.38, C.black, 0, 0.015, 0);
  add(g, CONE(0.14, 0.7), C.orange, 0, 0.38, 0);
  cyl(g, 0.105, 0.09, C.white, 0, 0.42, 0, 0, 0, 0.088);
  cyl(g, 0.065, 0.07, C.white, 0, 0.6, 0, 0, 0, 0.05);
};

const barrier: Builder = (g) => {
  for (const x of [-0.9, 0.9]) {
    box(g, 0.08, 1, 0.08, C.yellow, x, 0.5, 0);
    box(g, 0.08, 0.06, 0.6, C.black, x, 0.03, 0);
  }
  for (let i = 0; i < 6; i++) box(g, 0.3, 0.22, 0.04, i % 2 ? C.red : C.white, -0.75 + i * 0.3, 0.8, 0);
  box(g, 1.8, 0.04, 0.04, C.yellow, 0, 0.4, 0);
};

const extinguisher: Builder = (g) => {
  cyl(g, 0.09, 0.55, C.red, 0, 0.3, 0);
  add(g, SPH(0.09), C.red, 0, 0.575, 0);
  cyl(g, 0.03, 0.08, C.black, 0, 0.7, 0);
  box(g, 0.14, 0.03, 0.04, C.black, 0.05, 0.74, 0);
  cyl(g, 0.012, 0.4, C.black, 0.09, 0.5, 0.05, 0.2);
  box(g, 0.12, 0.14, 0.005, C.white, 0, 0.32, 0.09);
};

const safetySign: Builder = (g) => {
  cyl(g, 0.025, 1.6, C.steel, 0, 0.8, 0);
  box(g, 0.35, 0.04, 0.35, C.dark, 0, 0.02, 0);
  const tri = geo('tri', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0);
    s.lineTo(0.3, 0);
    s.lineTo(0, 0.52);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  });
  add(g, tri, C.yellow, 0, 1.25, 0.03);
  box(g, 0.05, 0.2, 0.01, C.black, 0, 1.47, 0.055);
  box(g, 0.05, 0.05, 0.01, C.black, 0, 1.33, 0.055);
};

const securityCamera: Builder = (g) => {
  box(g, 0.15, 0.2, 0.04, C.white, 0, 0.1, -0.2);
  box(g, 0.05, 0.05, 0.25, C.white, 0, 0.12, -0.05);
  box(g, 0.14, 0.13, 0.32, C.white, 0, 0.12, 0.15);
  cyl(g, 0.05, 0.04, C.black, 0, 0.12, 0.32, Math.PI / 2);
  add(g, SPH(0.012), mat('#ff3333', { e: '#ff0000' }), 0.05, 0.17, 0.31);
};

const controlPost: Builder = (g) => {
  box(g, 1.8, 2.4, 1.8, C.white, 0, 1.2, 0);
  box(g, 1.81, 0.9, 1.81, C.glass, 0, 1.6, 0);
  box(g, 2, 0.12, 2, C.dark, 0, 2.46, 0);
  box(g, 0.8, 2, 0.02, C.grey, 0, 1.0, 0.91);
  box(g, 1.2, 0.2, 0.02, mat('#36C8F4', { e: '#1b6f8a' }), 0, 2.2, 0.91);
};

const plant: Builder = (g) => {
  cyl(g, 0.2, 0.4, C.dark, 0, 0.2, 0, 0, 0, 0.25);
  cyl(g, 0.22, 0.03, mat('#3b2a1a', { r: 1 }), 0, 0.39, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    add(g, SPH(0.18), C.leaf, Math.cos(a) * 0.15, 0.75 + (i % 3) * 0.12, Math.sin(a) * 0.15);
  }
  add(g, SPH(0.2), C.leaf, 0, 1.05, 0);
};

const vase: Builder = (g) => {
  const pts = [0, 0.12, 0.17, 0.15, 0.09, 0.07, 0.1].map((r, i) => new THREE.Vector2(r, i * 0.08));
  add(g, geo('vase', () => new THREE.LatheGeometry(pts, 28)), mat('#7868F5', { r: 0.2, m: 0.3 }), 0, 0, 0);
};

const infoPanel: Builder = (g) => {
  for (const x of [-0.45, 0.45]) cyl(g, 0.025, 1.8, C.steel, x, 0.9, 0);
  box(g, 1.0, 0.7, 0.04, C.dark, 0, 1.4, 0);
  box(g, 0.9, 0.6, 0.01, mat('#36C8F4', { e: '#0f4d61' }), 0, 1.4, 0.025);
};

const accessory: Builder = (g) => {
  box(g, 0.4, 0.04, 0.3, C.wood, 0, 0.02, 0);
  add(g, SPH(0.08), C.orange, -0.1, 0.12, 0);
  cyl(g, 0.05, 0.18, C.white, 0.1, 0.13, 0.03);
};

const floorLamp: Builder = (g) => {
  cyl(g, 0.18, 0.03, C.dark, 0, 0.015, 0);
  cyl(g, 0.015, 1.6, C.dark, 0, 0.8, 0);
  cyl(g, 0.22, 0.28, mat('#efe6d2', { r: 0.9, e: '#5c513a' }), 0, 1.65, 0, 0, 0, 0.15);
};

const ceilingLight: Builder = (g) => {
  box(g, 1.2, 0.08, 0.3, C.white, 0, 0.04, 0);
  box(g, 1.1, 0.01, 0.22, C.light, 0, -0.005, 0);
  for (const x of [-0.5, 0.5]) cyl(g, 0.005, 0.6, C.steel, x, 0.34, 0);
};

const floodLight: Builder = (g) => {
  for (const a of [0, 2.1, 4.2]) box(g, 0.03, 1.5, 0.03, C.dark, Math.cos(a) * 0.2, 0.72, Math.sin(a) * 0.2);
  box(g, 0.45, 0.3, 0.15, C.dark, 0, 1.55, 0);
  box(g, 0.4, 0.25, 0.01, C.light, 0, 1.55, 0.08);
};

const van: Builder = (g) => {
  box(g, 2.0, 1.7, 3.2, C.white, 0, 1.35, -0.6);
  box(g, 2.0, 1.1, 1.6, C.white, 0, 1.05, 1.75);
  box(g, 1.9, 0.55, 0.05, C.glass, 0, 1.45, 2.4);
  box(g, 1.92, 0.4, 0.05, C.dark, 0, 0.55, 2.56);
  for (const x of [-0.9, 0.9]) for (const z of [-1.5, 1.7]) wheel(g, 0.36, 0.25, x, 0.36, z);
  box(g, 2.02, 0.25, 4.6, mat('#36C8F4', { r: 0.5 }), 0, 0.85, 0);
};

const truck: Builder = (g) => {
  box(g, 2.5, 2.6, 7, mat('#d9dee6', { r: 0.6 }), 0, 2.0, -1.5);
  box(g, 2.5, 2.4, 2.2, C.red, 0, 1.6, 3.2);
  box(g, 2.3, 0.8, 0.05, C.glass, 0, 2.2, 4.31);
  for (const x of [-1.1, 1.1]) for (const z of [-4, -2.9, 3.4]) wheel(g, 0.5, 0.35, x, 0.5, z);
  box(g, 2.4, 0.3, 9.4, C.dark, 0, 0.6, -0.3);
};

const electricCart: Builder = (g) => {
  box(g, 1.2, 0.35, 2.3, C.white, 0, 0.45, 0);
  box(g, 1.1, 0.12, 0.6, C.fabric, 0, 0.75, 0.1);
  box(g, 1.1, 0.5, 0.1, C.fabric, 0, 1.0, -0.2);
  for (const x of [-0.55, 0.55]) for (const z of [-0.9, 0.9]) box(g, 0.04, 1.4, 0.04, C.steel, x, 1.2, z);
  box(g, 1.2, 0.05, 2.0, C.dark, 0, 1.92, 0);
  for (const x of [-0.55, 0.55]) for (const z of [-0.8, 0.8]) wheel(g, 0.22, 0.18, x, 0.22, z);
};

const directionSign: Builder = (g) => {
  cyl(g, 0.03, 2.2, C.steel, 0, 1.1, 0);
  const arrow = geo('arrow', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.12);
    s.lineTo(0.25, -0.12);
    s.lineTo(0.25, -0.22);
    s.lineTo(0.5, 0);
    s.lineTo(0.25, 0.22);
    s.lineTo(0.25, 0.12);
    s.lineTo(-0.5, 0.12);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  });
  add(g, arrow, mat('#36C8F4', { r: 0.4 }), 0.3, 1.9, 0);
  box(g, 0.3, 0.04, 0.3, C.dark, 0, 0.02, 0);
};

const exitSign: Builder = (g) => {
  box(g, 0.4, 0.2, 0.06, C.exitGreen, 0, 0.1, 0);
  box(g, 0.08, 0.1, 0.005, C.white, -0.1, 0.1, 0.031);
  box(g, 0.16, 0.03, 0.005, C.white, 0.06, 0.1, 0.031);
};

const floorMarking: Builder = (g) => {
  for (let i = 0; i < 8; i++) box(g, 0.25, 0.005, 0.12, i % 2 ? C.black : C.yellow, -0.875 + i * 0.25, 0.0025, 0);
};

const wall: Builder = (g) => {
  box(g, 3, 3, 0.2, mat('#d4d9e0', { r: 0.9 }), 0, 1.5, 0);
  box(g, 3, 0.1, 0.22, C.dark, 0, 0.05, 0);
};

const column: Builder = (g) => {
  box(g, 0.4, 6, 0.4, mat('#c9cfd8', { r: 0.8 }), 0, 3, 0);
  for (let y = 0.1; y < 1.2; y += 0.4) box(g, 0.42, 0.2, 0.42, y % 0.8 < 0.3 ? C.yellow : C.black, 0, y + 0.1, 0);
};

const doorFrame: Builder = (g) => {
  for (const x of [-0.55, 0.55]) box(g, 0.1, 2.2, 0.2, C.dark, x, 1.1, 0);
  box(g, 1.2, 0.12, 0.2, C.dark, 0, 2.26, 0);
  box(g, 1.0, 2.15, 0.04, C.wood, 0, 1.08, 0);
  cyl(g, 0.02, 0.15, C.steel, 0.38, 1.05, 0.05, 0, Math.PI / 2);
};

const stairs: Builder = (g) => {
  for (let i = 0; i < 10; i++) box(g, 1.2, 0.18, 0.3, C.grey, 0, 0.09 + i * 0.18, -i * 0.28);
  for (const x of [-0.62, 0.62]) {
    cyl(g, 0.025, 3.2, C.yellow, x, 1.7, -1.25, 0.57);
    for (const z of [0, -2.5]) cyl(g, 0.025, 1.0, C.yellow, x, z === 0 ? 0.5 : 2.3, z);
  }
};

const genericCrate: Builder = (g) => {
  box(g, 1, 1, 1, C.wood, 0, 0.5, 0);
  for (const y of [0.05, 0.95]) box(g, 1.02, 0.1, 1.02, mat('#8a6238', { r: 0.9 }), 0, y, 0);
};

export const BUILTINS: BuiltinDef[] = [
  { key: 'forklift', name: 'Chariot élévateur', category: 'industrial', tags: ['manutention', 'logistique'], build: forklift },
  { key: 'rack', name: 'Rack industriel', category: 'industrial', tags: ['stockage', 'palettes'], build: rack },
  { key: 'pallet', name: 'Palette', category: 'industrial', tags: ['bois', 'europe'], build: pallet },
  { key: 'pallet-jack', name: 'Transpalette', category: 'industrial', tags: ['manutention'], build: palletJack },
  { key: 'conveyor', name: 'Convoyeur', category: 'industrial', tags: ['ligne', 'tri'], build: conveyor },
  { key: 'machine', name: 'Machine industrielle', category: 'industrial', tags: ['production', 'usine'], build: machine },
  { key: 'container', name: 'Conteneur 20 pieds', category: 'industrial', tags: ['maritime', 'stockage'], build: container },
  { key: 'carton', name: 'Caisse / carton', category: 'industrial', tags: ['colis'], build: carton },
  { key: 'loading-dock', name: 'Quai de chargement', category: 'industrial', tags: ['quai', 'expédition'], build: loadingDock },
  { key: 'handling-cart', name: 'Chariot de manutention', category: 'industrial', tags: ['manutention'], build: handlingCart },
  { key: 'desk', name: 'Bureau', category: 'furniture', tags: ['poste de travail'], build: desk },
  { key: 'chair', name: 'Chaise de bureau', category: 'furniture', tags: ['assise'], build: chair },
  { key: 'meeting-table', name: 'Table de réunion', category: 'furniture', tags: ['salle de réunion'], build: meetingTable },
  { key: 'cabinet', name: 'Armoire', category: 'furniture', tags: ['rangement'], build: cabinet },
  { key: 'sofa', name: 'Canapé', category: 'furniture', tags: ['accueil'], build: sofa },
  { key: 'shelf', name: 'Étagère', category: 'furniture', tags: ['rangement'], build: shelf },
  { key: 'counter', name: "Comptoir d'accueil", category: 'furniture', tags: ['réception'], build: counter },
  { key: 'cone', name: 'Cône de signalisation', category: 'security', tags: ['balisage'], build: cone },
  { key: 'barrier', name: 'Barrière', category: 'security', tags: ['balisage'], build: barrier },
  { key: 'extinguisher', name: 'Extincteur', category: 'security', tags: ['incendie'], build: extinguisher },
  { key: 'safety-sign', name: 'Panneau de sécurité', category: 'security', tags: ['danger'], build: safetySign },
  { key: 'camera', name: 'Caméra de surveillance', category: 'security', tags: ['vidéosurveillance'], build: securityCamera },
  { key: 'control-post', name: 'Poste de contrôle', category: 'security', tags: ['gardiennage'], build: controlPost },
  { key: 'plant', name: 'Plante', category: 'decor', tags: ['végétal'], build: plant },
  { key: 'vase', name: 'Objet décoratif', category: 'decor', tags: ['vase'], build: vase },
  { key: 'info-panel', name: "Panneau d'information", category: 'decor', tags: ['écran'], build: infoPanel },
  { key: 'accessory', name: 'Accessoire', category: 'decor', tags: ['objet'], build: accessory },
  { key: 'floor-lamp', name: 'Lampadaire', category: 'lighting', tags: ['lampe'], build: floorLamp },
  { key: 'ceiling-light', name: 'Luminaire suspendu', category: 'lighting', tags: ['plafond', 'LED'], build: ceilingLight },
  { key: 'flood-light', name: 'Projecteur sur trépied', category: 'lighting', tags: ['chantier'], build: floodLight },
  { key: 'van', name: 'Utilitaire', category: 'vehicles', tags: ['livraison'], build: van },
  { key: 'truck', name: 'Camion porteur', category: 'vehicles', tags: ['transport'], build: truck },
  { key: 'electric-cart', name: 'Voiturette électrique', category: 'vehicles', tags: ['site'], build: electricCart },
  { key: 'direction-sign', name: 'Panneau directionnel', category: 'signage', tags: ['orientation'], build: directionSign },
  { key: 'exit-sign', name: 'Bloc sortie de secours', category: 'signage', tags: ['évacuation'], build: exitSign },
  { key: 'floor-marking', name: 'Marquage au sol', category: 'signage', tags: ['balisage'], build: floorMarking },
  { key: 'wall', name: 'Cloison', category: 'architecture', tags: ['mur'], build: wall },
  { key: 'column', name: 'Poteau', category: 'architecture', tags: ['structure'], build: column },
  { key: 'door', name: 'Porte', category: 'architecture', tags: ['ouverture'], build: doorFrame },
  { key: 'stairs', name: 'Escalier', category: 'architecture', tags: ['circulation'], build: stairs },
  { key: 'crate', name: 'Caisse en bois', category: 'other', tags: ['générique'], build: genericCrate },
];

const sizeCache = new Map<string, Vec3>();

export function buildBuiltin(key: string): THREE.Group {
  const def = BUILTINS.find((b) => b.key === key);
  const g = new THREE.Group();
  g.name = key;
  if (!def) throw new Error(`Asset intégré inconnu : ${key}`);
  def.build(g);
  return g;
}

export function builtinSize(key: string): Vec3 {
  let s = sizeCache.get(key);
  if (!s) {
    const v = new THREE.Box3().setFromObject(buildBuiltin(key)).getSize(new THREE.Vector3());
    s = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
    sizeCache.set(key, s);
  }
  return s;
}
