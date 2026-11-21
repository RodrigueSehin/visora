import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Scene } from '../../types';

const PRESETS = {
  warehouse: { floor: '#7d838c', wall: '#c3c9d1', ceiling: '#9aa1ab', sky: '#dfe8f2', lane: '#f2c200', lights: true },
  office: { floor: '#a88a6a', wall: '#eef1f5', ceiling: '#f6f7f9', sky: '#f3f5f8', lane: '', lights: true },
  showroom: { floor: '#2a303a', wall: '#f2f3f5', ceiling: '#ffffff', sky: '#ffffff', lane: '', lights: true },
  empty: { floor: '#1a2436', wall: '', ceiling: '', sky: '#101827', lane: '', lights: false },
} as const;

/** Room shell, lights and floor for a scene. The floor is the default raycast target for placement. */
export function SceneEnvironment({ scene, showGrid, showAxes }: { scene: Scene; showGrid: boolean; showAxes: boolean }) {
  const p = PRESETS[scene.environment] ?? PRESETS.warehouse;
  const { width: W, depth: D, height: H } = scene.size;

  const lanes = useMemo(() => {
    if (!p.lane) return [];
    const out: { x: number; z: number; w: number; d: number }[] = [];
    for (const x of [-W / 4, W / 4]) out.push({ x, z: 0, w: 0.12, d: D * 0.9 });
    out.push({ x: 0, z: D / 2 - 3, w: W * 0.9, d: 0.12 });
    return out;
  }, [p.lane, W, D]);

  const lightRows = useMemo(() => {
    if (!p.lights || !p.ceiling) return [];
    const pts: [number, number][] = [];
    const sx = Math.max(4, W / 5);
    const sz = Math.max(4, D / 4);
    for (let x = -W / 2 + sx / 2; x < W / 2; x += sx) for (let z = -D / 2 + sz / 2; z < D / 2; z += sz) pts.push([x, z]);
    return pts;
  }, [p.lights, p.ceiling, W, D]);

  const shadowExtent = Math.max(W, D) / 2 + 2;

  return (
    <group>
      <color attach="background" args={[scene.environment === 'empty' ? '#101827' : '#141e30']} />
      <hemisphereLight args={[p.sky, "#3a3f47", 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[W * 0.3, H * 2.2, D * 0.35]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={H * 6}
      />

      <mesh name="floor" userData={{ floor: true }} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={p.floor} roughness={scene.environment === 'showroom' ? 0.25 : 0.85} metalness={scene.environment === 'showroom' ? 0.2 : 0} />
      </mesh>

      {lanes.map((l, i) => (
        <mesh key={i} position={[l.x, 0.004, l.z]} rotation-x={-Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[l.w, l.d]} />
          <meshStandardMaterial color={p.lane} roughness={0.6} />
        </mesh>
      ))}

      {p.wall && (
        // BackSide room: from outside, the near walls are culled so the interior stays visible.
        // Sunk 2 cm so its bottom face never z-fights with the floor plane.
        <mesh name="room" position={[0, H / 2 - 0.02, 0]}>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial color={p.wall} side={THREE.BackSide} roughness={0.9} />
        </mesh>
      )}

      {lightRows.map(([x, z], i) => (
        <mesh key={i} position={[x, H - 0.05, z]} raycast={() => null}>
          <boxGeometry args={[1.6, 0.06, 0.35]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff8e6" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {p.lights && <pointLight position={[0, H - 0.5, 0]} intensity={H * 2.5} distance={Math.max(W, D) * 1.2} decay={1.4} />}

      {showGrid && (
        <Grid
          position={[0, 0.006, 0]}
          args={[W, D]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#36C8F4"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#7868F5"
          fadeDistance={Math.max(W, D) * 1.4}
          fadeStrength={1.2}
          infiniteGrid={false}
        />
      )}
      {showAxes && <axesHelper args={[2]} position={[0, 0.01, 0]} />}
    </group>
  );
}
