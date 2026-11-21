// Renders asset thumbnails with one shared offscreen renderer (avoids exhausting
// WebGL contexts) and a serial queue.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let renderer: THREE.WebGLRenderer | null | undefined;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, string>();

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function setup(): boolean {
  if (renderer !== undefined) return renderer !== null;
  if (!webglAvailable()) {
    renderer = null;
    return false;
  }
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 192, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.4));
  camera = new THREE.PerspectiveCamera(32, 256 / 192, 0.01, 1000);
  return true;
}

export function frameObject(object: THREE.Object3D, cam: THREE.PerspectiveCamera, dir = new THREE.Vector3(1, 0.75, 1.3)) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.01);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05;
  cam.position.copy(center).add(dir.normalize().multiplyScalar(dist));
  cam.near = dist / 100;
  cam.far = dist * 100;
  cam.lookAt(center);
  cam.updateProjectionMatrix();
}

/** Returns a PNG data URL, or undefined if WebGL is unavailable. */
export function renderThumbnail(cacheKey: string | null, object: THREE.Object3D): Promise<string | undefined> {
  if (cacheKey && cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey));
  const job = queue.then(() => {
    if (!setup() || !renderer) return undefined;
    scene.add(object);
    frameObject(object, camera);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(object);
    if (cacheKey) cache.set(cacheKey, url);
    return url;
  });
  queue = job.catch(() => undefined);
  return job;
}
