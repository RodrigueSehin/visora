// Generator of the dashboard hero illustration (public/visora-hero.webp) from VISORA's own procedural
// assets (warehouse, racks, forklift) with a cyan "AI reconstruction" wireframe. Not called at runtime:
// to regenerate, run in the dev server console:
//   (await import('/src/creator/heroImage.ts')).renderHeroImage(1650, 690)
// and save the returned WebP data URL as public/visora-hero.webp.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildBuiltin } from '../three/procedural';
import { webglAvailable } from '../three/thumbnails';

const KEY = 'visora:hero:v1';
let pending: Promise<string | undefined> | undefined;

export function renderHeroImage(width = 1100, height = 460): Promise<string | undefined> {
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) return Promise.resolve(cached);
  } catch {
    /* ignore */
  }
  return (pending ??= new Promise((resolve) => {
    if (!webglAvailable()) return resolve(undefined);
    // Defer so the dashboard paints first.
    setTimeout(() => {
      try {
        resolve(draw(width, height));
      } catch {
        resolve(undefined);
      }
    }, 50);
  }));
}

function draw(width: number, height: number): string {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  scene.add(sun, new THREE.HemisphereLight(0x9fdcff, 0x1d2b43, 0.6));

  // Building shell: floor slab, back wall, glowing cyan wireframe of the volume.
  const W = 16, D = 10, H = 6;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.3, D + 2), new THREE.MeshStandardMaterial({ color: '#2b3a55', roughness: 0.6 }));
  floor.position.y = -0.15;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#c9d3df', roughness: 0.8, metalness: 0.2 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), wallMat);
  back.position.set(0, H / 2, -D / 2);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), wallMat);
  side.position.set(-W / 2, H / 2, 0);
  back.receiveShadow = side.receiveShadow = true;
  scene.add(back, side);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: '#36C8F4', transparent: true, opacity: 0.95 }),
  );
  edges.position.y = H / 2;
  scene.add(edges);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshBasicMaterial({ color: '#36C8F4', transparent: true, opacity: 0.06, depthWrite: false }),
  );
  glass.position.y = H / 2;
  scene.add(glass);
  // Floor scan grid (AI reconstruction cue).
  const grid = new THREE.GridHelper(W, 16, '#7868F5', '#36C8F4');
  (grid.material as THREE.Material).opacity = 0.35;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.02;
  scene.add(grid);

  const place = (key: string, x: number, z: number, ry = 0, s = 1) => {
    const o = buildBuiltin(key);
    o.position.set(x, 0, z);
    o.rotation.y = ry;
    o.scale.setScalar(s);
    scene.add(o);
  };
  for (const x of [-5.4, -2.6, 0.2, 3.0]) place('rack', x, -3.6);
  place('forklift', 3.2, 1.6, -0.9);
  place('pallet', -1.5, 1.8, 0.2);
  place('carton', -1.5, 1.95, 0.2);
  place('pallet-jack', 0.6, 2.8, 1.2);
  place('cone', 6.4, 3.8);
  place('cone', 5.6, 4.3);
  place('plant', -7.2, 4.2);

  const cam = new THREE.PerspectiveCamera(30, width / height, 0.1, 200);
  cam.position.set(15, 11, 21);
  cam.lookAt(0.5, 1.6, 0);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/webp', 0.9);
  renderer.dispose();
  pmrem.dispose();
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    /* quota: not cached */
  }
  return url;
}
