// Pure transform math (no rendering) used by the store for grouping / reparenting.
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { SceneObject3D, Vec3 } from '../types';

export function localMatrix(o: Pick<SceneObject3D, 'position' | 'rotation' | 'scale'>): Matrix4 {
  const q = new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(o.rotation.x),
      MathUtils.degToRad(o.rotation.y),
      MathUtils.degToRad(o.rotation.z),
      'XYZ',
    ),
  );
  return new Matrix4().compose(
    new Vector3(o.position.x, o.position.y, o.position.z),
    q,
    new Vector3(o.scale.x, o.scale.y, o.scale.z),
  );
}

export function worldMatrix(id: string, objects: SceneObject3D[]): Matrix4 {
  const byId = new Map(objects.map((o) => [o.id, o]));
  let m = new Matrix4();
  let cur = byId.get(id);
  const chain: SceneObject3D[] = [];
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  for (const node of chain) m = m.multiply(localMatrix(node));
  return m;
}

export function decompose(m: Matrix4): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  m.decompose(p, q, s);
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return {
    position: { x: r(p.x), y: r(p.y), z: r(p.z) },
    rotation: { x: r(MathUtils.radToDeg(e.x)), y: r(MathUtils.radToDeg(e.y)), z: r(MathUtils.radToDeg(e.z)) },
    scale: { x: r(s.x), y: r(s.y), z: r(s.z) },
  };
}

/** Transform expressed relative to a new parent (or the scene root when parentId is undefined). */
export function reparentTransform(id: string, newParentId: string | undefined, objects: SceneObject3D[]) {
  const world = worldMatrix(id, objects);
  if (!newParentId) return decompose(world);
  const parentInv = worldMatrix(newParentId, objects).invert();
  return decompose(parentInv.multiply(world));
}
