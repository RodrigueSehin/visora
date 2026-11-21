// High-level object commands shared by the toolbar, context menus, hierarchy and shortcuts.
import { objectRegistry, surfaceHeightAt, viewport, worldBox } from '../three/registry';
import { topLevelOnly, useEditor, withDescendants } from './editor';

const st = () => useEditor.getState();

export function selectedObjects() {
  const s = st();
  const ids = new Set(s.selection);
  return (s.project?.objects ?? []).filter((o) => ids.has(o.id));
}

export async function deleteSelection(ids = st().selection) {
  const s = st();
  if (!s.project || !ids.length) return;
  const locked = s.project.objects.filter((o) => ids.includes(o.id) && o.locked);
  const deletable = ids.filter((id) => !locked.some((l) => l.id === id));
  if (!deletable.length) {
    s.toast({ kind: 'warning', text: 'Objet verrouillé : déverrouillez-le avant de le supprimer.' });
    return;
  }
  const total = withDescendants(deletable, s.project.objects).size;
  const first = s.project.objects.find((o) => o.id === deletable[0]);
  const ok = await s.confirm({
    title: total > 1 ? `Supprimer ${total} objets ?` : `Supprimer « ${first?.name} » ?`,
    message:
      (total > deletable.length ? 'Les objets contenus dans les groupes seront également supprimés. ' : '') +
      (locked.length ? `${locked.length} objet(s) verrouillé(s) seront conservés. ` : '') +
      'Vous pourrez annuler cette action avec Ctrl+Z.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (ok) st().removeObjects(deletable);
}

export function duplicateSelection() {
  const ids = st().selection;
  if (ids.length) st().duplicateObjects(ids);
}

export function toggleVisibility(ids = st().selection) {
  const objs = selectedFrom(ids);
  if (!objs.length) return;
  const show = objs.some((o) => !o.visible);
  st().patchObjects(ids, () => ({ visible: show }), show ? 'Afficher' : 'Masquer');
}

export function toggleLock(ids = st().selection) {
  const objs = selectedFrom(ids);
  if (!objs.length) return;
  const lock = objs.some((o) => !o.locked);
  st().patchObjects(ids, () => ({ locked: lock }), lock ? 'Verrouiller' : 'Déverrouiller');
}

function selectedFrom(ids: string[]) {
  const set = new Set(ids);
  return (st().project?.objects ?? []).filter((o) => set.has(o.id));
}

export function groupSelection() {
  const s = st();
  if (s.selection.length < 2) return;
  s.groupObjects(s.selection);
}

export function ungroupSelection() {
  const s = st();
  const g = selectedObjects().find((o) => o.kind === 'group');
  if (g) s.ungroup(g.id);
}

export function focusSelection() {
  const ids = st().selection;
  viewport()?.focus(ids.length ? ids : []);
}

/** Moves top-level objects so their bounding box rests on the floor (or the surface below). */
export function placeOnGround(ids = st().selection, useSurfaces = st().snap.surfaces) {
  const s = st();
  if (!s.project) return;
  const roots = topLevelOnly(ids, s.project.objects);
  const objs = s.project.objects.filter((o) => roots.includes(o.id) && !o.parentId && !o.locked);
  const sceneRoots = s.project.objects
    .filter((o) => o.sceneId === s.activeSceneId && !o.parentId)
    .map((o) => objectRegistry.get(o.id))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const items = objs.flatMap((o) => {
    const box = worldBox(o.id);
    const node = objectRegistry.get(o.id);
    if (!box || !node) return [];
    const c = box.getCenter(box.min.clone());
    const ground = useSurfaces ? surfaceHeightAt(c.x, c.z, sceneRoots, [node]) : 0;
    return [{ id: o.id, position: { ...o.position, y: +(o.position.y + ground - box.min.y).toFixed(4) } }];
  });
  if (items.length) s.setTransforms(items, 'Poser au sol');
  else if (ids.length) s.toast({ kind: 'info', text: 'Seuls les objets de premier niveau non verrouillés peuvent être posés au sol.' });
}

export function placeAt(where: 'origin' | 'center') {
  // The scene floor is centred on the origin: "center" keeps the height, "origin" also resets Y.
  const s = st();
  const objs = selectedObjects().filter((o) => !o.locked && !o.parentId);
  if (!objs.length) return;
  const target = { x: 0, z: 0 };
  // Keep relative layout of a multi-selection: move its centroid to the target.
  const cx = objs.reduce((a, o) => a + o.position.x, 0) / objs.length;
  const cz = objs.reduce((a, o) => a + o.position.z, 0) / objs.length;
  s.setTransforms(
    objs.map((o) => ({
      id: o.id,
      position: {
        x: +(o.position.x - cx + target.x).toFixed(4),
        y: where === 'origin' ? 0 : o.position.y,
        z: +(o.position.z - cz + target.z).toFixed(4),
      },
    })),
    where === 'origin' ? 'Placer à l’origine' : 'Centrer dans la scène',
  );
}

export function resetTransforms(ids = st().selection) {
  const objs = selectedFrom(ids).filter((o) => !o.locked);
  if (!objs.length) return;
  st().setTransforms(
    objs.map((o) => ({ id: o.id, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } })),
    'Réinitialiser les transformations',
  );
}
