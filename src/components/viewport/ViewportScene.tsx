import { CameraControls, Html, OrthographicCamera, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { Copy, Eye, Lock, Scan, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import * as THREE from 'three';
import { topLevelOnly, useEditor } from '../../store/editor';
import { deleteSelection, duplicateSelection, focusSelection, toggleLock, toggleVisibility } from '../../store/objectActions';
import { objectRegistry, setViewportApi, surfaceHeightAt, worldBox, type CameraPreset } from '../../three/registry';
import type { Scene, Vec3 } from '../../types';

const R2D = THREE.MathUtils.radToDeg;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Shared flag so a click that ends a gizmo drag does not clear the selection. */
export const gizmoState = { dragging: false, lastEnd: 0 };

function sceneRootNodes(): THREE.Object3D[] {
  const s = useEditor.getState();
  return (s.project?.objects ?? [])
    .filter((o) => o.sceneId === s.activeSceneId && !o.parentId)
    .map((o) => objectRegistry.get(o.id))
    .filter((x): x is THREE.Object3D => !!x);
}

type CamState = { p: THREE.Vector3; t: THREE.Vector3 };

/** Viewport UI state shared by the DOM overlays and the camera rig. */
export const useViewportUi = create<{ autoRotate: boolean; filmstrip: boolean; set: (p: Partial<{ autoRotate: boolean; filmstrip: boolean }>) => void }>((set) => ({
  autoRotate: false,
  filmstrip: true,
  set: (p) => set(p),
}));

/** Camera per view mode + the imperative viewport API (presets, focus, history, picking). */
/** yaw 0 looks toward -Z; positive yaw turns right; pitch positive looks up (degrees). */
export function viewDirection(yaw: number, pitch: number) {
  const y = THREE.MathUtils.degToRad(yaw);
  const p = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

export function CameraRig({ scene }: { scene: Scene }) {
  const viewMode = useEditor((s) => s.viewMode);
  const ref = useRef<CameraControlsImpl>(null);
  const { camera, gl, invalidate, scene: three } = useThree();
  const hist = useRef<{ stack: CamState[]; idx: number }>({ stack: [], idx: -1 });
  const keys = useRef(new Set<string>());
  // 360° scenes are always viewed from the sphere centre; plan view does not apply to them.
  const panorama = scene.kind === 'panorama';
  const firstPerson = panorama || viewMode === 'immersive' || viewMode === 'visitor';
  const plan = viewMode === 'plan' && !panorama;
  // Locked scenes: visitors look around from the start point but cannot walk.
  const locked = !!scene.lockCamera && viewMode === 'visitor' && !panorama;
  const autoRotate = useViewportUi((s) => s.autoRotate);
  const view = scene.initialView ?? { yaw: 0, pitch: 0, fov: 70 };
  const { width: W, depth: D, height: H } = scene.size;

  const home = useMemo(
    () => () => {
      const c = ref.current;
      if (!c) return;
      if (plan) {
        c.setLookAt(0, Math.max(W, D) * 2, 0.001, 0, 0, 0, false);
        c.zoomTo(Math.min(gl.domElement.clientWidth / (W * 1.15), gl.domElement.clientHeight / (D * 1.15)), false);
      } else if (firstPerson) {
        // Start point: sphere centre (360°) or near the entrance at eye height; looking along the initial view.
        const p = panorama ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 1.6, D / 2 - 2);
        const dir = viewDirection(view.yaw, view.pitch);
        const t = p.clone().addScaledVector(dir, 0.01);
        c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
      } else {
        c.setLookAt(W * 0.42, Math.min(H * 1.3, 14), D * 0.62, 0, 0.5, 0, true);
      }
    },
    [plan, firstPerson, panorama, view.yaw, view.pitch, W, D, H, gl],
  );

  // Configure controls per mode.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const A = CameraControlsImpl.ACTION;
    c.minDistance = firstPerson ? 0.01 : 0.5;
    c.maxDistance = firstPerson ? 0.01 : Math.max(W, D) * 3;
    c.dollyToCursor = !firstPerson;
    c.azimuthRotateSpeed = firstPerson ? -0.35 : 1;
    c.polarRotateSpeed = firstPerson ? -0.35 : 1;
    c.minPolarAngle = 0;
    c.maxPolarAngle = plan ? 0 : firstPerson ? Math.PI : Math.PI / 2 - 0.02;
    c.mouseButtons.left = plan ? A.TRUCK : A.ROTATE;
    c.mouseButtons.right = firstPerson ? A.NONE : A.TRUCK;
    c.mouseButtons.wheel = plan ? A.ZOOM : firstPerson ? A.ZOOM : A.DOLLY;
    c.touches.one = plan ? A.TOUCH_TRUCK : A.TOUCH_ROTATE;
    c.touches.two = plan ? A.TOUCH_ZOOM_TRUCK : firstPerson ? A.TOUCH_ZOOM : A.TOUCH_DOLLY_TRUCK;
    if (!plan && camera instanceof THREE.PerspectiveCamera) c.zoomTo(1, false);
    hist.current = { stack: [], idx: -1 };
    home();
    invalidate();
    if (firstPerson && camera instanceof THREE.PerspectiveCamera) {
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    }
  }, [plan, firstPerson, scene.id, W, D, home, camera, invalidate, view.fov]);

  // Camera history (previous / next view).
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const push = () => {
      const h = hist.current;
      const s = { p: c.getPosition(new THREE.Vector3()), t: c.getTarget(new THREE.Vector3()) };
      const last = h.stack[h.idx];
      if (last && last.p.distanceTo(s.p) < 0.01 && last.t.distanceTo(s.t) < 0.01) return;
      h.stack = [...h.stack.slice(0, h.idx + 1), s].slice(-30);
      h.idx = h.stack.length - 1;
    };
    const onRest = () => push();
    c.addEventListener('rest', onRest);
    return () => c.removeEventListener('rest', onRest);
  }, [plan, firstPerson]);

  // WASD / arrows walking in immersive & visitor modes.
  useEffect(() => {
    if (!firstPerson || panorama || locked) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (['z', 'w', 'q', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keys.current.add(k);
        invalidate();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keys.current.clear();
    };
  }, [firstPerson, panorama, locked, invalidate]);

  // Auto-rotation: continuous slow turn, stopped by any user interaction with the camera.
  useEffect(() => {
    const c = ref.current;
    if (!c || !autoRotate) return;
    const stop = () => useViewportUi.getState().set({ autoRotate: false });
    c.addEventListener('controlstart', stop);
    invalidate();
    return () => c.removeEventListener('controlstart', stop);
  }, [autoRotate, plan, firstPerson, invalidate]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (c && autoRotate && !plan) {
      c.rotate(THREE.MathUtils.degToRad(firstPerson ? -5 : 7) * Math.min(dt, 0.05), 0, false);
      invalidate();
    }
    if (!c || !firstPerson || !keys.current.size) return;
    const k = keys.current;
    const speed = 3 * Math.min(dt, 0.05);
    const f = (k.has('z') || k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('q') || k.has('a') || k.has('arrowleft') ? 1 : 0);
    if (f) c.forward(f * speed, false);
    if (r) c.truck(r * speed, 0, false);
    // Keep the visitor inside the room.
    const p = c.getPosition(new THREE.Vector3());
    const cx = THREE.MathUtils.clamp(p.x, -W / 2 + 0.3, W / 2 - 0.3);
    const cz = THREE.MathUtils.clamp(p.z, -D / 2 + 0.3, D / 2 - 0.3);
    if (cx !== p.x || cz !== p.z) c.moveTo(cx, p.y, cz, false);
    invalidate();
  });

  // Development only: lets E2E tests and debugging inspect the live scene (stripped from production builds).
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __visora?: unknown }).__visora = { scene: three, camera, gl };
  }, [three, camera, gl]);

  useEffect(() => {
    const ndc = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    setViewportApi({
      focus(ids) {
        const c = ref.current;
        if (!c) return;
        const box = new THREE.Box3();
        for (const id of ids) {
          const b = worldBox(id);
          if (b) box.union(b);
        }
        if (box.isEmpty()) return home();
        c.fitToBox(box, true, { paddingTop: 0.6, paddingBottom: 0.6, paddingLeft: 0.6, paddingRight: 0.6 });
      },
      reset: () => home(),
      preset(p: CameraPreset) {
        const c = ref.current;
        if (!c || plan || firstPerson) return;
        const d = Math.max(W, D) * 0.9;
        const pos: Record<CameraPreset, [number, number, number]> = {
          top: [0, d * 1.4, 0.01],
          front: [0, H * 0.4, d],
          side: [d, H * 0.4, 0],
          iso: [W * 0.42, Math.min(H * 1.3, 14), D * 0.62],
        };
        c.setLookAt(...pos[p], 0, 0.5, 0, true);
      },
      zoom(factor) {
        const c = ref.current;
        if (!c) return;
        if (plan || firstPerson) c.zoomTo(c.camera.zoom * factor, true);
        else c.dolly((factor - 1) * c.distance * 0.6, true);
      },
      getView() {
        const c = ref.current;
        if (!c || !firstPerson) return null;
        const dir = c.getTarget(new THREE.Vector3()).sub(c.getPosition(new THREE.Vector3())).normalize();
        const r1 = (n: number) => Math.round(n * 10) / 10;
        return {
          yaw: r1(THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z))),
          pitch: r1(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)))),
          fov: r1((camera as THREE.PerspectiveCamera).fov ?? 70),
        };
      },
      setView(v) {
        const c = ref.current;
        if (!c || !firstPerson) return;
        const p = c.getPosition(new THREE.Vector3());
        const t = p.clone().addScaledVector(viewDirection(v.yaw, v.pitch), 0.01);
        c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = v.fov;
          camera.updateProjectionMatrix();
        }
        invalidate();
      },
      pickSurface(clientX, clientY) {
        const rect = gl.domElement.getBoundingClientRect();
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const targets = ['panorama', 'room', 'floor'].map((n) => three.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
        targets.push(...sceneRootNodes());
        const hit = ray.intersectObjects(targets, true).find((h) => h.object.visible);
        if (!hit) return null;
        // On the 360° sphere, markers sit at a fixed comfortable radius along the view ray.
        if (hit.object.name === 'panorama') return hit.point.clone().normalize().multiplyScalar(8);
        const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        return hit.point.clone().addScaledVector(n, 0.05);
      },
      rotate(az, polar) {
        const c = ref.current;
        if (!c || plan) return;
        const k = firstPerson ? -1 : 1;
        c.rotate(THREE.MathUtils.degToRad(az) * k, THREE.MathUtils.degToRad(polar) * k, true);
        invalidate();
      },
      canWalk: () => firstPerson && !panorama && !locked,
      capture() {
        gl.render(three, camera);
        const src = gl.domElement;
        const w = Math.min(960, src.width);
        const out = document.createElement('canvas');
        out.width = w;
        out.height = Math.round((src.height / src.width) * w);
        out.getContext('2d')?.drawImage(src, 0, 0, out.width, out.height);
        return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
      },
      walk(distance) {
        const c = ref.current;
        if (!c || !firstPerson || panorama || locked) return;
        c.forward(distance, false);
        // Same room bounds as keyboard walking.
        const p = c.getPosition(new THREE.Vector3());
        c.moveTo(THREE.MathUtils.clamp(p.x, -W / 2 + 0.3, W / 2 - 0.3), p.y, THREE.MathUtils.clamp(p.z, -D / 2 + 0.3, D / 2 - 0.3), false);
        invalidate();
      },
      back() {
        const h = hist.current;
        if (h.idx <= 0 || !ref.current) return;
        h.idx--;
        const s = h.stack[h.idx];
        ref.current.setLookAt(s.p.x, s.p.y, s.p.z, s.t.x, s.t.y, s.t.z, true);
      },
      forward() {
        const h = hist.current;
        if (h.idx >= h.stack.length - 1 || !ref.current) return;
        h.idx++;
        const s = h.stack[h.idx];
        ref.current.setLookAt(s.p.x, s.p.y, s.p.z, s.t.x, s.t.y, s.t.z, true);
      },
      canBack: () => hist.current.idx > 0,
      canForward: () => hist.current.idx < hist.current.stack.length - 1,
      pick(clientX, clientY, { surfaces, exclude }) {
        const rect = gl.domElement.getBoundingClientRect();
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const targets: THREE.Object3D[] = [];
        const floor = three.getObjectByName('floor');
        if (floor) targets.push(floor);
        if (surfaces) targets.push(...sceneRootNodes().filter((n) => !exclude?.has(n.userData.objectId)));
        const hit = ray.intersectObjects(targets, true).find((h) => h.object.visible);
        if (hit) return hit.point.clone();
        // Fallback: intersect the ground plane even outside the floor mesh.
        const p = new THREE.Vector3();
        return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
      },
      invalidate: () => invalidate(),
    });
    return () => setViewportApi(null);
  }, [camera, gl, three, home, plan, firstPerson, panorama, locked, W, D, H, invalidate]);

  return (
    <>
      {plan ? (
        <OrthographicCamera makeDefault position={[0, 100, 0.001]} near={0.1} far={1000} zoom={20} />
      ) : (
        <PerspectiveCamera makeDefault fov={firstPerson ? 70 : 50} near={0.05} far={1000} position={[W * 0.42, 12, D * 0.62]} />
      )}
      <CameraControls key={`${viewMode === 'visitor' ? 'immersive' : viewMode}`} ref={ref} makeDefault smoothTime={0.2} />
    </>
  );
}

/** Transform gizmo for the selection (all modes for one object, translation for several). */
export function SelectionGizmo() {
  const selection = useEditor((s) => s.selection);
  const objects = useEditor((s) => s.project?.objects);
  const tool = useEditor((s) => s.tool);
  const snap = useEditor((s) => s.snap);
  const viewMode = useEditor((s) => s.viewMode);
  const showGizmos = useEditor((s) => s.overlays.gizmos);
  const invalidate = useThree((s) => s.invalidate);
  const pivot = useMemo(() => new THREE.Object3D(), []);
  const [targets, setTargets] = useState<THREE.Object3D[]>([]);
  const start = useRef<{ pivot: THREE.Vector3; world: THREE.Vector3[]; scale?: THREE.Vector3 }>();

  const editableIds = useMemo(() => {
    if (!objects) return [];
    const byId = new Map(objects.map((o) => [o.id, o]));
    return topLevelOnly(selection, objects).filter((id) => byId.get(id) && !byId.get(id)!.locked);
  }, [selection, objects]);

  // Registry entries appear after the objects mount: resolve on the next frames.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const resolve = () => {
      const t = editableIds.map((id) => objectRegistry.get(id)).filter((x): x is THREE.Object3D => !!x);
      if (t.length < editableIds.length && tries++ < 30) raf = requestAnimationFrame(resolve);
      setTargets(t);
    };
    resolve();
    return () => cancelAnimationFrame(raf);
  }, [editableIds]);

  const multi = targets.length > 1;
  useEffect(() => {
    if (!multi) return;
    const c = new THREE.Vector3();
    for (const t of targets) c.add(t.getWorldPosition(new THREE.Vector3()));
    pivot.position.copy(c.divideScalar(targets.length));
    pivot.updateMatrixWorld();
    invalidate();
  }, [multi, targets, objects, pivot, invalidate]);

  if (viewMode === 'visitor' || !showGizmos || !targets.length) return null;
  const mode = multi ? 'translate' : tool;
  const groundLock = snap.ground && mode === 'translate';

  const groundSnap = (node: THREE.Object3D) => {
    if (!snap.ground || !node.userData.objectId) return;
    const obj = useEditor.getState().project?.objects.find((o) => o.id === node.userData.objectId);
    if (!obj || obj.parentId) return;
    node.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(node);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const ground = snap.surfaces ? surfaceHeightAt(c.x, c.z, sceneRootNodes(), [node]) : 0;
    node.position.y += ground - box.min.y;
  };

  return (
    <>
      {multi && <primitive object={pivot} />}
      <TransformControls
        object={multi ? pivot : targets[0]}
        mode={mode}
        size={0.85}
        showY={!groundLock}
        translationSnap={snap.grid ? snap.gridSize : null}
        rotationSnap={snap.rotation ? THREE.MathUtils.degToRad(snap.rotationStep) : null}
        scaleSnap={snap.grid ? 0.05 : null}
        onMouseDown={() => {
          gizmoState.dragging = true;
          start.current = {
            pivot: pivot.position.clone(),
            world: targets.map((t) => t.getWorldPosition(new THREE.Vector3())),
            scale: targets[0].scale.clone(),
          };
        }}
        onObjectChange={() => {
          const s0 = start.current;
          if (!s0) return;
          if (multi) {
            const delta = pivot.position.clone().sub(s0.pivot);
            targets.forEach((t, i) => {
              const w = s0.world[i].clone().add(delta);
              t.position.copy(t.parent ? t.parent.worldToLocal(w) : w);
              if (groundLock) groundSnap(t);
            });
            return;
          }
          const t = targets[0];
          const obj = useEditor.getState().project?.objects.find((o) => o.id === t.userData.objectId);
          if (mode === 'scale' && obj?.uniformScale && s0.scale) {
            const r = [t.scale.x / s0.scale.x, t.scale.y / s0.scale.y, t.scale.z / s0.scale.z];
            const k = r.reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a), 1);
            t.scale.copy(s0.scale).multiplyScalar(Math.max(0.01, k));
          }
          if (mode === 'scale') t.scale.set(Math.max(0.01, t.scale.x), Math.max(0.01, t.scale.y), Math.max(0.01, t.scale.z));
          if (groundLock || (mode !== 'translate' && snap.ground)) groundSnap(t);
        }}
        onMouseUp={() => {
          gizmoState.dragging = false;
          gizmoState.lastEnd = performance.now();
          const label = multi ? 'Déplacer la sélection' : mode === 'translate' ? 'Déplacer' : mode === 'rotate' ? 'Tourner' : 'Redimensionner';
          const v = (x: THREE.Vector3 | THREE.Euler): Vec3 =>
            x instanceof THREE.Euler ? { x: r4(R2D(x.x)), y: r4(R2D(x.y)), z: r4(R2D(x.z)) } : { x: r4(x.x), y: r4(x.y), z: r4(x.z) };
          useEditor.getState().setTransforms(
            targets.map((t) => ({ id: t.userData.objectId, position: v(t.position), rotation: v(t.rotation), scale: v(t.scale) })),
            label,
          );
        }}
      />
    </>
  );
}

function SelectionBox({ id, color }: { id: string; color: string }) {
  const helper = useMemo(() => {
    const h = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(color));
    h.raycast = () => {};
    (h.material as THREE.LineBasicMaterial).depthTest = false;
    h.renderOrder = 999;
    return h;
  }, [color]);
  useEffect(() => () => helper.dispose(), [helper]);
  useFrame(() => {
    const o = objectRegistry.get(id);
    if (!o) return void (helper.visible = false);
    helper.box.setFromObject(o);
    helper.visible = !helper.box.isEmpty() && o.visible;
  });
  return <primitive object={helper} />;
}

export function SelectionBoxes() {
  const selection = useEditor((s) => s.selection);
  const objects = useEditor((s) => s.project?.objects);
  const visitor = useEditor((s) => s.viewMode === 'visitor');
  if (visitor) return null;
  return (
    <>
      {selection.map((id) => {
        const o = objects?.find((x) => x.id === id);
        return <SelectionBox key={id} id={id} color={o?.locked ? '#f59e0b' : o?.kind === 'group' ? '#7868F5' : '#36C8F4'} />;
      })}
    </>
  );
}

/** Recomputes the world box of an object whenever the project data changes. */
function useWorldBox(id: string | undefined) {
  const objects = useEditor((s) => s.project?.objects);
  const [box, setBox] = useState<THREE.Box3 | null>(null);
  useEffect(() => {
    if (!id) return setBox(null);
    let raf = requestAnimationFrame(function tick() {
      const b = worldBox(id);
      setBox(b);
      // Models may still be loading: retry a few times until the box is available.
      if (!b) raf = requestAnimationFrame(tick);
    });
    const t = setTimeout(() => setBox(worldBox(id)), 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [id, objects]);
  return box;
}

export function Measures() {
  const show = useEditor((s) => s.overlays.measures);
  const primary = useEditor((s) => s.selection[s.selection.length - 1]);
  const box = useWorldBox(show ? primary : undefined);
  if (!show || !box) return null;
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const label = (text: string, pos: [number, number, number]) => (
    <Html position={pos} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-navy-950">{text}</div>
    </Html>
  );
  const f = (n: number) => `${n.toFixed(2).replace('.', ',')} m`;
  return (
    <group>
      {label(`L ${f(size.x)}`, [c.x, box.min.y, box.max.z + 0.15])}
      {label(`P ${f(size.z)}`, [box.max.x + 0.15, box.min.y, c.z])}
      {label(`H ${f(size.y)}`, [box.max.x + 0.15, c.y, box.max.z])}
    </group>
  );
}

/** Floating actions above the selected object. */
export function ContextToolbar() {
  const selection = useEditor((s) => s.selection);
  const visitor = useEditor((s) => s.viewMode === 'visitor');
  const primary = selection.length === 1 ? selection[0] : undefined;
  const obj = useEditor((s) => s.project?.objects.find((o) => o.id === primary));
  const box = useWorldBox(primary);
  if (!obj || !box || visitor) return null;
  const c = box.getCenter(new THREE.Vector3());
  const btn = 'rounded-md p-1.5 text-ink-muted hover:bg-navy-600 hover:text-ink focus-ring';
  return (
    <Html position={[c.x, box.max.y + 0.35, c.z]} center zIndexRange={[20, 0]}>
      <div className="flex select-none items-center gap-0.5 whitespace-nowrap rounded-xl border border-navy-500 bg-navy-800/95 px-1.5 py-1 shadow-panel" onPointerDown={(e) => e.stopPropagation()}>
        <span className="max-w-[140px] truncate px-1.5 text-xs font-medium text-ink">{obj.name}</span>
        {obj.locked && <Lock size={12} className="mr-1 text-amber-400" aria-label="Verrouillé" />}
        <button className={btn} title="Cadrer (F)" aria-label="Cadrer la sélection" onClick={focusSelection}>
          <Scan size={14} />
        </button>
        <button className={btn} title="Masquer (H)" aria-label="Masquer" onClick={() => toggleVisibility()}>
          <Eye size={14} />
        </button>
        <button className={btn} title={obj.locked ? 'Déverrouiller (L)' : 'Verrouiller (L)'} aria-label="Verrouiller" onClick={() => toggleLock()}>
          <Lock size={14} />
        </button>
        <button className={btn} title="Dupliquer (Ctrl+D)" aria-label="Dupliquer" onClick={duplicateSelection}>
          <Copy size={14} />
        </button>
        <button className={`${btn} hover:text-red-400`} title="Supprimer (Suppr)" aria-label="Supprimer" onClick={() => void deleteSelection()} disabled={obj.locked}>
          <Trash2 size={14} />
        </button>
      </div>
    </Html>
  );
}

export function DropGhost({ ghost }: { ghost: { point: THREE.Vector3; size: Vec3 } | null }) {
  if (!ghost) return null;
  const { point, size } = ghost;
  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh position={[0, size.y / 2, 0]} raycast={() => null}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#36C8F4" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <lineSegments position={[0, size.y / 2, 0]} raycast={() => null}>
        <edgesGeometry args={[new THREE.BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial color="#36C8F4" />
      </lineSegments>
    </group>
  );
}
