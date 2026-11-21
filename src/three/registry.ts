// Bridges React DOM UI and the R3F scene: object id → live Object3D, and a small
// imperative API (camera presets, raycasting) registered by the viewport.
import * as THREE from 'three';

export const objectRegistry = new Map<string, THREE.Object3D>();

export type CameraPreset = 'top' | 'front' | 'side' | 'iso';

export type ViewportApi = {
  focus: (ids: string[]) => void;
  reset: () => void;
  preset: (p: CameraPreset) => void;
  zoom: (factor: number) => void;
  /** First-person modes: move forward (positive) or backward along the view direction. */
  walk: (distance: number) => void;
  /** Current look direction and field of view (first-person / 360° scenes). */
  getView: () => { yaw: number; pitch: number; fov: number } | null;
  /** Smoothly turns the first-person / 360° camera to a view (guided tours). */
  setView: (view: { yaw: number; pitch: number; fov: number }) => void;
  /** Point under the cursor on any surface: 360° sphere, room, floor or objects (hotspot placement). */
  pickSurface: (clientX: number, clientY: number) => THREE.Vector3 | null;
  /** Turns the camera (degrees): orbit in 3D view, look around in first-person / 360°. */
  rotate: (azimuthDeg: number, polarDeg: number) => void;
  /** Whether walking applies to the current view (first-person 3D scene, not locked). */
  canWalk: () => boolean;
  /** JPEG snapshot of the current view (scene thumbnails), at most 960 px wide. */
  capture: () => Promise<Blob | null>;
  back: () => void;
  forward: () => void;
  canBack: () => boolean;
  canForward: () => boolean;
  /** Raycasts from client coordinates onto the floor / object surfaces. */
  pick: (clientX: number, clientY: number, opts: { surfaces: boolean; exclude?: Set<string> }) => THREE.Vector3 | null;
  invalidate: () => void;
};

let api: ViewportApi | null = null;
export const setViewportApi = (a: ViewportApi | null) => {
  api = a;
};
export const viewport = () => api;

/** Asset currently dragged from the library (dataTransfer is unreadable during dragover). */
export const dragState: { assetId: string | null } = { assetId: null };

export function worldBox(id: string): THREE.Box3 | null {
  const o = objectRegistry.get(id);
  if (!o) return null;
  o.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(o);
  return b.isEmpty() ? null : b;
}

/** Highest surface under (x, z) among the given roots, ignoring excluded objects. */
export function surfaceHeightAt(x: number, z: number, roots: THREE.Object3D[], excludeRoots: THREE.Object3D[] = []): number {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
  const excluded = new Set<THREE.Object3D>();
  for (const r of excludeRoots) r.traverse((o) => excluded.add(o));
  const up = (h: THREE.Intersection) => (h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y : 1);
  const hits = ray.intersectObjects(roots, true).filter((h) => !excluded.has(h.object) && h.object.visible && up(h) > 0.3);
  return hits.length ? Math.max(0, hits[0].point.y) : 0;
}
