import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { acquireInstance, applyInstanceStyle, releaseInstance } from '../../three/assetCache';
import { objectRegistry } from '../../three/registry';
import { findAsset, useEditor } from '../../store/editor';
import type { Asset3D, SceneObject3D } from '../../types';

const D2R = THREE.MathUtils.degToRad;

/** Loads (or reuses) the model of an asset and applies per-instance style/shadows. */
function AssetInstance({ asset, obj }: { asset: Asset3D; obj: SceneObject3D }) {
  const [state, setState] = useState<{ node?: THREE.Object3D; error?: string }>({});
  const invalidate = useThree((s) => s.invalidate);
  const fileKey = asset.source.kind === 'file' ? asset.source.fileId : asset.source.key;

  useEffect(() => {
    let cancelled = false;
    let node: THREE.Object3D | undefined;
    setState({});
    acquireInstance(asset)
      .then((n) => {
        if (cancelled) return releaseInstance(asset, n);
        node = n;
        setState({ node: n });
      })
      .catch((e) => !cancelled && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
      if (node) releaseInstance(asset, node);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id, fileKey, asset.unitScale]);

  useEffect(() => {
    if (!state.node) return;
    applyInstanceStyle(state.node, obj.style, obj.castShadow, obj.receiveShadow);
    invalidate();
  }, [state.node, obj.style, obj.castShadow, obj.receiveShadow, invalidate]);

  const size = asset.size ?? { x: 1, y: 1, z: 1 };
  if (state.error)
    return (
      <group>
        <mesh position={[0, size.y / 2, 0]}>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshBasicMaterial color="#ef4444" wireframe />
        </mesh>
        <Html center position={[0, size.y + 0.3, 0]} zIndexRange={[20, 0]}>
          <div className="whitespace-nowrap rounded-md border border-red-500/60 bg-navy-900/90 px-2 py-1 text-[11px] text-red-300">
            Asset indisponible : {state.error}
          </div>
        </Html>
      </group>
    );
  if (!state.node)
    return (
      <mesh position={[0, size.y / 2, 0]}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#36C8F4" wireframe transparent opacity={0.5} />
      </mesh>
    );
  return <primitive object={state.node} />;
}

type NodeProps = {
  obj: SceneObject3D;
  childrenOf: Map<string | undefined, SceneObject3D[]>;
  visitor: boolean;
  onPick: (e: ThreeEvent<MouseEvent>, id: string) => void;
};

const ObjectNode = memo(function ObjectNode({ obj, childrenOf, visitor, onPick }: NodeProps) {
  const ref = useRef<THREE.Group>(null);
  // Asset objects keep their identity until edited, so this selector is stable.
  const asset = useEditor((s) => (obj.assetId ? findAsset(s.project, obj.assetId) : undefined));
  const showLabels = useEditor((s) => s.overlays.labels) && !visitor;

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    objectRegistry.set(obj.id, g);
    return () => {
      if (objectRegistry.get(obj.id) === g) objectRegistry.delete(obj.id);
    };
  }, [obj.id]);

  const hidden = !obj.visible || (visitor && obj.studioOnly);
  const kids = childrenOf.get(obj.id) ?? [];

  return (
    <group
      ref={ref}
      name={obj.name}
      userData={{ objectId: obj.id }}
      position={[obj.position.x, obj.position.y, obj.position.z]}
      rotation={[D2R(obj.rotation.x), D2R(obj.rotation.y), D2R(obj.rotation.z)]}
      scale={[obj.scale.x, obj.scale.y, obj.scale.z]}
      visible={!hidden}
    >
      {obj.kind === 'object' && asset && !asset.deletedAt && (
        <group
          onClick={(e) => onPick(e, obj.id)}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <AssetInstance asset={asset} obj={obj} />
        </group>
      )}
      {kids.map((c) => (
        <ObjectNode key={c.id} obj={c} childrenOf={childrenOf} visitor={visitor} onPick={onPick} />
      ))}
      {showLabels && obj.kind === 'object' && !hidden && (
        <Html position={[0, (asset?.size?.y ?? 1) + 0.25, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-navy-900/80 px-1.5 py-0.5 text-[10px] text-ink">{obj.name}</div>
        </Html>
      )}
    </group>
  );
});

/** Renders the active scene's objects. Click selects the root group first, then drills down. */
export function SceneObjects({ onVisitorAction }: { onVisitorAction: (obj: SceneObject3D) => void }) {
  const objects = useEditor((s) => s.project?.objects);
  const sceneId = useEditor((s) => s.activeSceneId);
  const viewMode = useEditor((s) => s.viewMode);
  const showObjects = useEditor((s) => s.overlays.objects);
  const visitor = viewMode === 'visitor';

  const { childrenOf, byId } = useMemo(() => {
    const m = new Map<string | undefined, SceneObject3D[]>();
    const by = new Map<string, SceneObject3D>();
    for (const o of objects ?? []) {
      if (o.sceneId !== sceneId) continue;
      by.set(o.id, o);
      const k = o.parentId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    for (const list of m.values()) list.sort((a, b) => a.order - b.order);
    return { childrenOf: m, byId: by };
  }, [objects, sceneId]);

  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  const onPick = useMemo(
    () => (e: ThreeEvent<MouseEvent>, leafId: string) => {
      e.stopPropagation();
      // Ignore clicks that ended a camera drag, and clicks used to place a hotspot / navigation point.
      if (e.delta > 4 || useEditor.getState().placement) return;
      const map = byIdRef.current;
      const path: SceneObject3D[] = [];
      let cur = map.get(leafId);
      while (cur) {
        path.unshift(cur);
        cur = cur.parentId ? map.get(cur.parentId) : undefined;
      }
      const st = useEditor.getState();
      if (st.viewMode === 'visitor') {
        const withAction = [...path].reverse().find((o) => o.interaction && o.interaction.type !== 'none');
        if (withAction) onVisitorAction(withAction);
        return;
      }
      let target = path[0];
      if (e.altKey) target = path[path.length - 1];
      else {
        const selectedIdx = path.findIndex((p) => st.selection.includes(p.id));
        if (selectedIdx >= 0 && selectedIdx < path.length - 1) target = path[selectedIdx + 1];
        else if (selectedIdx >= 0) target = path[selectedIdx];
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) st.select([target.id], 'toggle');
      else st.select([target.id]);
    },
    [onVisitorAction],
  );

  if (!showObjects) return null;
  return (
    <group>
      {(childrenOf.get(undefined) ?? []).map((o) => (
        <ObjectNode key={o.id} obj={o} childrenOf={childrenOf} visitor={visitor} onPick={onPick} />
      ))}
    </group>
  );
}
