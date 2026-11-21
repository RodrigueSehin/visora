import { create } from 'zustand';
import { builtinAssets, isBuiltinId } from '../lib/catalog';
import { createStarterProject } from '../lib/defaultProject';
import { nowIso, uid } from '../lib/ids';
import { reparentTransform } from '../lib/transforms';
import { ConflictError, loadActiveProject, publishProject, saveProject } from '../services/persistence';
import type { Asset3D, ProjectDoc, Scene, SceneObject3D, Vec3 } from '../types';

export type Tool = 'translate' | 'rotate' | 'scale';
export type ViewMode = '3d' | 'immersive' | '360' | 'plan' | 'visitor';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export type Snap = {
  grid: boolean;
  gridSize: number;
  ground: boolean;
  surfaces: boolean;
  rotation: boolean;
  rotationStep: number;
};

export type Overlays = {
  grid: boolean;
  axes: boolean;
  gizmos: boolean;
  objects: boolean;
  labels: boolean;
  measures: boolean;
  hotspots: boolean;
  navigation: boolean;
  annotations: boolean;
  zones: boolean;
};

export type Toast = { id: string; kind: 'success' | 'error' | 'info' | 'warning'; text: string; actionLabel?: string; onAction?: () => void };

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type Snapshot = Pick<ProjectDoc, 'objects' | 'assets' | 'favorites' | 'scenes' | 'hotspots' | 'navigation' | 'settings' | 'floorPlans' | 'guidedTours' | 'annotations'>;

export type StudioModule = 'scenes' | 'navigation' | 'hotspots' | 'media' | 'objects' | 'plan' | 'tour' | 'annotations' | 'appearance' | 'settings';
/** Item selected outside of 3D objects (a hotspot or a navigation point). */
export type Focus = { kind: 'hotspot' | 'nav' | 'annotation'; id: string } | null;
type HistoryEntry = { label: string; snap: Snapshot; key?: string; at: number };

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;

export type EditorState = {
  project: ProjectDoc | null;
  baseRevision: number;
  loadState: 'loading' | 'ready' | 'error';
  /** True in the visitor space: the loaded document is a published snapshot and must never be saved. */
  readOnly: boolean;
  loadError?: string;
  activeSceneId: string;
  selection: string[];
  tool: Tool;
  snap: Snap;
  overlays: Overlays;
  viewMode: ViewMode;
  past: HistoryEntry[];
  future: HistoryEntry[];
  dirty: boolean;
  saveStatus: SaveStatus;
  saveError?: string;
  lastSavedAt?: string;
  conflict?: ProjectDoc;
  panels: { library: boolean; inspector: boolean; hierarchy: boolean };
  toasts: Toast[];
  confirmRequest: ConfirmRequest | null;
  focusRequest: number;
  module: StudioModule;
  focus: Focus;
  /** When set, the next click in the viewport positions this hotspot / navigation point. */
  placement: Focus;
  setModule: (m: StudioModule) => void;
  setFocus: (f: Focus) => void;
  setPlacement: (f: Focus) => void;

  init: (doc?: ProjectDoc, opts?: { readOnly?: boolean; viewMode?: ViewMode }) => Promise<void>;
  apply: (label: string, fn: (p: ProjectDoc) => ProjectDoc, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;

  setActiveScene: (id: string) => void;
  select: (ids: string[], mode?: 'replace' | 'toggle' | 'add') => void;
  clearSelection: () => void;

  addObject: (assetId: string, opts?: { position?: Vec3; sceneId?: string; select?: boolean }) => string | undefined;
  patchObjects: (ids: string[], patch: (o: SceneObject3D) => Partial<SceneObject3D>, label: string, coalesceKey?: string) => void;
  setTransforms: (items: { id: string; position?: Vec3; rotation?: Vec3; scale?: Vec3 }[], label: string) => void;
  duplicateObjects: (ids: string[], targetSceneId?: string) => string[];
  removeObjects: (ids: string[]) => void;
  groupObjects: (ids: string[]) => string | undefined;
  ungroup: (groupId: string) => void;
  reparent: (id: string, parentId: string | undefined) => void;
  reorder: (id: string, beforeId: string | null) => void;
  align: (ids: string[], axis: 'x' | 'z', mode: 'min' | 'center' | 'max') => void;
  distribute: (ids: string[], axis: 'x' | 'z') => void;

  addAsset: (asset: Asset3D) => void;
  updateAsset: (id: string, patch: Partial<Asset3D>, label?: string) => void;
  deleteAsset: (id: string) => void;
  duplicateAsset: (id: string) => string | undefined;
  toggleFavorite: (id: string) => void;

  addScene: () => void;
  renameScene: (id: string, name: string) => void;
  deleteScene: (id: string) => void;
  renameProject: (name: string) => void;

  save: (opts?: { force?: boolean; silent?: boolean }) => Promise<boolean>;
  publish: () => Promise<void>;
  resolveConflict: (choice: 'reload' | 'overwrite') => Promise<void>;
  setAutosave: (seconds: number) => void;

  setTool: (t: Tool) => void;
  setSnap: (p: Partial<Snap>) => void;
  setOverlay: (k: keyof Overlays, v: boolean) => void;
  setViewMode: (m: ViewMode) => void;
  togglePanel: (k: keyof EditorState['panels'], v?: boolean) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  confirm: (r: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  requestFocus: () => void;
};

const snapshot = (p: ProjectDoc): Snapshot => ({
  objects: p.objects,
  assets: p.assets,
  favorites: p.favorites,
  scenes: p.scenes,
  hotspots: p.hotspots,
  navigation: p.navigation,
  settings: p.settings,
  floorPlans: p.floorPlans,
  guidedTours: p.guidedTours,
  annotations: p.annotations,
});

/** Older documents have no hotspots/navigation arrays. */
const normalize = (p: ProjectDoc): ProjectDoc => ({ ...p, hotspots: p.hotspots ?? [], navigation: p.navigation ?? [], floorPlans: p.floorPlans ?? [], guidedTours: p.guidedTours ?? [], annotations: p.annotations ?? [] });

/** Ids plus all their descendants. */
export function withDescendants(ids: string[], objects: SceneObject3D[]): Set<string> {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of objects) if (o.parentId && out.has(o.parentId) && !out.has(o.id)) {
      out.add(o.id);
      grew = true;
    }
  }
  return out;
}

/** Drops ids whose ancestor is also in the list (so a group and its child are not processed twice). */
export function topLevelOnly(ids: string[], objects: SceneObject3D[]): string[] {
  const set = new Set(ids);
  const byId = new Map(objects.map((o) => [o.id, o]));
  return ids.filter((id) => {
    let p = byId.get(id)?.parentId;
    while (p) {
      if (set.has(p)) return false;
      p = byId.get(p)?.parentId;
    }
    return true;
  });
}

export function allAssets(p: ProjectDoc | null): Asset3D[] {
  return [...builtinAssets(), ...(p?.assets.filter((a) => !a.deletedAt) ?? [])];
}

export function findAsset(p: ProjectDoc | null, id: string | null | undefined): Asset3D | undefined {
  if (!id) return undefined;
  if (isBuiltinId(id)) return builtinAssets().find((a) => a.id === id);
  return p?.assets.find((a) => a.id === id);
}

/** Finds a free floor position near the scene centre for an object footprint. */
function freeSpot(objects: SceneObject3D[], p: ProjectDoc, size: Vec3): Vec3 {
  const occupied = objects
    .filter((o) => !o.parentId)
    .map((o) => {
      const s = findAsset(p, o.assetId)?.size ?? { x: 1, y: 1, z: 1 };
      return { x: o.position.x, z: o.position.z, hx: (s.x * Math.abs(o.scale.x)) / 2, hz: (s.z * Math.abs(o.scale.z)) / 2 };
    });
  const hx = size.x / 2 + 0.2;
  const hz = size.z / 2 + 0.2;
  const free = (x: number, z: number) =>
    occupied.every((b) => Math.abs(b.x - x) > b.hx + hx || Math.abs(b.z - z) > b.hz + hz);
  const step = Math.max(0.5, Math.ceil(Math.max(size.x, size.z) * 2) / 2);
  for (let ring = 0; ring < 30; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dz] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
        const x = dx * step;
        const z = dz * step;
        if (free(x, z)) return { x, y: 0, z };
      }
    }
  }
  return { x: 0, y: 0, z: 0 };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  baseRevision: 0,
  loadState: 'loading',
  readOnly: false,
  activeSceneId: '',
  selection: [],
  tool: 'translate',
  snap: { grid: false, gridSize: 0.5, ground: true, surfaces: true, rotation: true, rotationStep: 15 },
  overlays: {
    grid: true,
    axes: false,
    gizmos: true,
    objects: true,
    labels: false,
    measures: false,
    hotspots: true,
    navigation: true,
    annotations: true,
    zones: true,
  },
  viewMode: '3d',
  past: [],
  future: [],
  dirty: false,
  saveStatus: 'idle',
  panels: { library: true, inspector: true, hierarchy: true },
  toasts: [],
  confirmRequest: null,
  focusRequest: 0,
  module: 'objects',
  focus: null,
  placement: null,
  setModule: (module) => set({ module, placement: null, focus: null, selection: [] }),
  setFocus: (focus) => set({ focus, selection: focus ? [] : get().selection }),
  setPlacement: (placement) => set({ placement }),

  async init(doc, opts = {}) {
    set({ loadState: 'loading' });
    try {
      let p = doc ? normalize(doc) : await loadActiveProject().then((d) => d && normalize(d));
      let created = false;
      if (!p) {
        p = normalize(await saveProject(normalize(createStarterProject()), 0));
        created = true;
      }
      const scenes = [...p.scenes].sort((a, b) => a.order - b.order);
      set({
        project: p,
        baseRevision: p.revision,
        loadState: 'ready',
        activeSceneId: (p.settings.homeSceneId && scenes.find((s) => s.id === p!.settings.homeSceneId)?.id) || scenes[0]?.id || '',
        focus: null,
        placement: null,
        selection: [],
        past: [],
        future: [],
        dirty: false,
        saveStatus: 'idle',
        lastSavedAt: p.updatedAt,
        conflict: undefined,
        readOnly: !!opts.readOnly,
        viewMode: opts.viewMode ?? '3d',
      });
      if (created) get().toast({ kind: 'info', text: 'Projet de départ créé et enregistré localement.' });
    } catch (e) {
      set({ loadState: 'error', loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  apply(label, fn, coalesceKey) {
    const { project, past } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;
    const last = past[past.length - 1];
    const now = Date.now();
    const coalesce = coalesceKey && last?.key === coalesceKey && now - last.at < COALESCE_MS;
    const newPast = coalesce
      ? [...past.slice(0, -1), { ...last, at: now }]
      : [...past, { label, snap: snapshot(project), key: coalesceKey, at: now }].slice(-HISTORY_LIMIT);
    set({ project: { ...next, updatedAt: nowIso() }, past: newPast, future: [], dirty: true, saveStatus: get().saveStatus === 'error' ? 'error' : 'idle' });
  },

  undo() {
    const { project, past, future, selection } = get();
    const entry = past[past.length - 1];
    if (!project || !entry) return;
    const restored = { ...project, ...entry.snap };
    const ids = new Set(restored.objects.map((o) => o.id));
    set({
      project: restored,
      past: past.slice(0, -1),
      future: [{ ...entry, snap: snapshot(project) }, ...future],
      selection: selection.filter((id) => ids.has(id)),
      dirty: true,
    });
    get().toast({ kind: 'info', text: `Annulé : ${entry.label}` });
  },

  redo() {
    const { project, past, future, selection } = get();
    const entry = future[0];
    if (!project || !entry) return;
    const restored = { ...project, ...entry.snap };
    const ids = new Set(restored.objects.map((o) => o.id));
    set({
      project: restored,
      future: future.slice(1),
      past: [...past, { ...entry, snap: snapshot(project) }],
      selection: selection.filter((id) => ids.has(id)),
      dirty: true,
    });
    get().toast({ kind: 'info', text: `Rétabli : ${entry.label}` });
  },

  setActiveScene(id) {
    if (id === get().activeSceneId) return;
    set({ activeSceneId: id, selection: [], focus: null, placement: null });
  },

  select(ids, mode = 'replace') {
    const cur = get().selection;
    if (mode === 'replace') set({ selection: [...new Set(ids)] });
    else if (mode === 'add') set({ selection: [...new Set([...cur, ...ids])] });
    else {
      const s = new Set(cur);
      for (const id of ids) s.has(id) ? s.delete(id) : s.add(id);
      set({ selection: [...s] });
    }
  },
  clearSelection: () => set({ selection: [] }),

  addObject(assetId, opts = {}) {
    const p = get().project;
    const asset = findAsset(p, assetId);
    if (!p || !asset || asset.deletedAt) {
      get().toast({ kind: 'error', text: 'Asset indisponible : impossible de l’ajouter.' });
      return undefined;
    }
    const sceneId = opts.sceneId ?? get().activeSceneId;
    const sceneObjects = p.objects.filter((o) => o.sceneId === sceneId);
    const position = opts.position ?? freeSpot(sceneObjects, p, asset.size ?? { x: 1, y: 1, z: 1 });
    const t = nowIso();
    const sameName = sceneObjects.filter((o) => o.name === asset.name || o.name.startsWith(`${asset.name} (`)).length;
    const obj: SceneObject3D = {
      id: uid('obj'),
      sceneId,
      assetId,
      kind: 'object',
      name: sameName ? `${asset.name} (${sameName + 1})` : asset.name,
      category: asset.category,
      description: asset.description,
      tags: asset.tags,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      locked: false,
      studioOnly: false,
      uniformScale: true,
      castShadow: true,
      receiveShadow: true,
      interaction: { type: 'none' },
      order: sceneObjects.filter((o) => !o.parentId).length,
      createdAt: t,
      updatedAt: t,
    };
    get().apply(`Ajouter « ${obj.name} »`, (d) => ({ ...d, objects: [...d.objects, obj] }));
    if (opts.select !== false) set({ selection: [obj.id] });
    return obj.id;
  },

  patchObjects(ids, patch, label, coalesceKey) {
    const set_ = new Set(ids);
    const t = nowIso();
    get().apply(
      label,
      (d) => ({ ...d, objects: d.objects.map((o) => (set_.has(o.id) ? { ...o, ...patch(o), updatedAt: t } : o)) }),
      coalesceKey,
    );
  },

  setTransforms(items, label) {
    const map = new Map(items.map((i) => [i.id, i]));
    const t = nowIso();
    get().apply(label, (d) => ({
      ...d,
      objects: d.objects.map((o) => {
        const it = map.get(o.id);
        if (!it) return o;
        return {
          ...o,
          position: it.position ?? o.position,
          rotation: it.rotation ?? o.rotation,
          scale: it.scale ?? o.scale,
          updatedAt: t,
        };
      }),
    }));
  },

  duplicateObjects(ids, targetSceneId) {
    const p = get().project;
    if (!p) return [];
    const roots = topLevelOnly(ids, p.objects);
    const all = withDescendants(roots, p.objects);
    const idMap = new Map<string, string>();
    for (const id of all) idMap.set(id, uid('obj'));
    const t = nowIso();
    const crossScene = targetSceneId && targetSceneId !== get().activeSceneId;
    const copies: SceneObject3D[] = [];
    for (const o of p.objects) {
      if (!all.has(o.id)) continue;
      const isRoot = roots.includes(o.id);
      copies.push({
        ...o,
        id: idMap.get(o.id)!,
        sceneId: targetSceneId ?? o.sceneId,
        parentId: isRoot ? (crossScene ? undefined : o.parentId) : idMap.get(o.parentId!),
        name: isRoot ? `${o.name} (copie)` : o.name,
        position: isRoot && !crossScene ? { ...o.position, x: o.position.x + 1 } : o.position,
        // Copies are never locked, so they can be moved right away.
        locked: isRoot ? false : o.locked,
        createdAt: t,
        updatedAt: t,
      });
    }
    const label = crossScene ? 'Copier vers une autre scène' : 'Dupliquer';
    get().apply(label, (d) => ({ ...d, objects: [...d.objects, ...copies] }));
    const newRoots = roots.map((r) => idMap.get(r)!);
    if (!crossScene) set({ selection: newRoots });
    return newRoots;
  },

  removeObjects(ids) {
    const p = get().project;
    if (!p || !ids.length) return;
    const all = withDescendants(ids, p.objects);
    get().apply(all.size > 1 ? `Supprimer ${all.size} objets` : 'Supprimer l’objet', (d) => ({
      ...d,
      objects: d.objects.filter((o) => !all.has(o.id)),
    }));
    set({ selection: get().selection.filter((id) => !all.has(id)) });
  },

  groupObjects(ids) {
    const p = get().project;
    if (!p) return undefined;
    const roots = topLevelOnly(ids, p.objects);
    const nodes = roots.map((id) => p.objects.find((o) => o.id === id)!).filter(Boolean);
    if (nodes.length < 2) return undefined;
    const parentId = nodes[0].parentId;
    if (nodes.some((n) => n.parentId !== parentId)) {
      get().toast({ kind: 'warning', text: 'Les objets doivent appartenir au même groupe parent pour être groupés.' });
      return undefined;
    }
    const c = nodes.reduce((acc, n) => ({ x: acc.x + n.position.x, z: acc.z + n.position.z }), { x: 0, z: 0 });
    const t = nowIso();
    const group: SceneObject3D = {
      id: uid('grp'),
      sceneId: nodes[0].sceneId,
      assetId: null,
      kind: 'group',
      name: `Groupe ${p.objects.filter((o) => o.kind === 'group').length + 1}`,
      category: 'other',
      position: { x: +(c.x / nodes.length).toFixed(3), y: 0, z: +(c.z / nodes.length).toFixed(3) },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      locked: false,
      studioOnly: false,
      uniformScale: true,
      castShadow: true,
      receiveShadow: true,
      interaction: { type: 'none' },
      parentId,
      order: Math.min(...nodes.map((n) => n.order)),
      createdAt: t,
      updatedAt: t,
    };
    const withGroup = [...p.objects, group];
    const moved = new Map(
      nodes.map((n) => [n.id, reparentTransform(n.id, group.id, withGroup)]),
    );
    get().apply('Grouper', (d) => ({
      ...d,
      objects: [
        ...d.objects.map((o) => (moved.has(o.id) ? { ...o, ...moved.get(o.id)!, parentId: group.id, updatedAt: t } : o)),
        group,
      ],
    }));
    set({ selection: [group.id] });
    return group.id;
  },

  ungroup(groupId) {
    const p = get().project;
    const g = p?.objects.find((o) => o.id === groupId);
    if (!p || !g || g.kind !== 'group') return;
    const children = p.objects.filter((o) => o.parentId === groupId);
    const moved = new Map(children.map((c) => [c.id, reparentTransform(c.id, g.parentId, p.objects)]));
    const t = nowIso();
    get().apply('Dégrouper', (d) => ({
      ...d,
      objects: d.objects
        .filter((o) => o.id !== groupId)
        .map((o) => (moved.has(o.id) ? { ...o, ...moved.get(o.id)!, parentId: g.parentId, updatedAt: t } : o)),
    }));
    set({ selection: children.map((c) => c.id) });
  },

  reparent(id, parentId) {
    const p = get().project;
    const o = p?.objects.find((x) => x.id === id);
    if (!p || !o || o.parentId === parentId || id === parentId) return;
    if (parentId && withDescendants([id], p.objects).has(parentId)) {
      get().toast({ kind: 'warning', text: 'Impossible de placer un groupe dans un de ses propres enfants.' });
      return;
    }
    const tr = reparentTransform(id, parentId, p.objects);
    const siblings = p.objects.filter((x) => x.sceneId === o.sceneId && x.parentId === parentId);
    get().apply('Réorganiser', (d) => ({
      ...d,
      objects: d.objects.map((x) => (x.id === id ? { ...x, ...tr, parentId, order: siblings.length, updatedAt: nowIso() } : x)),
    }));
  },

  reorder(id, beforeId) {
    const p = get().project;
    const o = p?.objects.find((x) => x.id === id);
    if (!p || !o || id === beforeId) return;
    const siblings = p.objects
      .filter((x) => x.sceneId === o.sceneId && x.parentId === o.parentId && x.id !== id)
      .sort((a, b) => a.order - b.order);
    const idx = beforeId ? siblings.findIndex((s) => s.id === beforeId) : siblings.length;
    siblings.splice(idx < 0 ? siblings.length : idx, 0, o);
    const orders = new Map(siblings.map((s, i) => [s.id, i]));
    get().apply('Réorganiser', (d) => ({
      ...d,
      objects: d.objects.map((x) => (orders.has(x.id) ? { ...x, order: orders.get(x.id)! } : x)),
    }));
  },

  align(ids, axis, mode) {
    const p = get().project;
    if (!p) return;
    const nodes = topLevelOnly(ids, p.objects).map((id) => p.objects.find((o) => o.id === id)!);
    if (nodes.length < 2) return;
    const vals = nodes.map((n) => n.position[axis]);
    const target = mode === 'min' ? Math.min(...vals) : mode === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    get().setTransforms(
      nodes.filter((n) => !n.locked).map((n) => ({ id: n.id, position: { ...n.position, [axis]: +target.toFixed(3) } })),
      `Aligner sur ${axis.toUpperCase()}`,
    );
  },

  distribute(ids, axis) {
    const p = get().project;
    if (!p) return;
    const nodes = topLevelOnly(ids, p.objects)
      .map((id) => p.objects.find((o) => o.id === id)!)
      .sort((a, b) => a.position[axis] - b.position[axis]);
    if (nodes.length < 3) return;
    const first = nodes[0].position[axis];
    const step = (nodes[nodes.length - 1].position[axis] - first) / (nodes.length - 1);
    get().setTransforms(
      nodes.filter((n) => !n.locked).map((n) => ({ id: n.id, position: { ...n.position, [axis]: +(first + step * nodes.indexOf(n)).toFixed(3) } })),
      `Répartir sur ${axis.toUpperCase()}`,
    );
  },

  addAsset(asset) {
    get().apply(`Importer « ${asset.name} »`, (d) => ({ ...d, assets: [...d.assets, asset] }));
  },

  updateAsset(id, patch, label = 'Modifier l’asset') {
    if (isBuiltinId(id)) return;
    get().apply(label, (d) => ({
      ...d,
      assets: d.assets.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a)),
    }));
  },

  deleteAsset(id) {
    if (isBuiltinId(id)) return;
    const p = get().project;
    if (!p) return;
    const instances = p.objects.filter((o) => o.assetId === id).map((o) => o.id);
    const remove = withDescendants(instances, p.objects);
    get().apply('Supprimer l’asset de la bibliothèque', (d) => ({
      ...d,
      assets: d.assets.map((a) => (a.id === id ? { ...a, deletedAt: nowIso() } : a)),
      objects: d.objects.filter((o) => !remove.has(o.id)),
      favorites: d.favorites.filter((f) => f !== id),
    }));
    set({ selection: get().selection.filter((s) => !remove.has(s)) });
  },

  duplicateAsset(id) {
    const p = get().project;
    const a = findAsset(p, id);
    if (!p || !a) return undefined;
    const t = nowIso();
    const copy: Asset3D = { ...a, id: uid('ast'), projectId: p.id, name: `${a.name} (copie)`, imported: a.imported, createdAt: t, updatedAt: t };
    get().apply('Dupliquer l’asset', (d) => ({ ...d, assets: [...d.assets, copy] }));
    return copy.id;
  },

  toggleFavorite(id) {
    const fav = get().project?.favorites.includes(id);
    get().apply(fav ? 'Retirer des favoris' : 'Ajouter aux favoris', (d) => ({
      ...d,
      favorites: fav ? d.favorites.filter((f) => f !== id) : [...d.favorites, id],
    }));
  },

  addScene() {
    const p = get().project;
    if (!p) return;
    const scene: Scene = {
      id: uid('scn'),
      name: `Scène ${p.scenes.length + 1}`,
      environment: 'warehouse',
      size: { width: 30, depth: 24, height: 9 },
      order: Math.max(-1, ...p.scenes.map((s) => s.order)) + 1,
    };
    get().apply('Ajouter une scène', (d) => ({ ...d, scenes: [...d.scenes, scene] }));
    set({ activeSceneId: scene.id, selection: [] });
  },

  renameScene(id, name) {
    const n = name.trim();
    if (!n) return;
    get().apply('Renommer la scène', (d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === id ? { ...s, name: n } : s)) }));
  },

  deleteScene(id) {
    const p = get().project;
    if (!p || p.scenes.length <= 1) {
      get().toast({ kind: 'warning', text: 'Un projet doit conserver au moins une scène.' });
      return;
    }
    get().apply('Supprimer la scène', (d) => ({
      ...d,
      scenes: d.scenes.filter((s) => s.id !== id),
      objects: d.objects.filter((o) => o.sceneId !== id),
    }));
    if (get().activeSceneId === id) {
      const first = [...get().project!.scenes].sort((a, b) => a.order - b.order)[0];
      set({ activeSceneId: first.id, selection: [] });
    }
  },

  renameProject(name) {
    const n = name.trim();
    const p = get().project;
    if (!p || !n || n === p.name) return;
    set({ project: { ...p, name: n }, dirty: true });
  },

  async save(opts = {}) {
    const { project, baseRevision, saveStatus } = get();
    if (!project || saveStatus === 'saving' || get().readOnly) return false;
    set({ saveStatus: 'saving', saveError: undefined });
    try {
      const saved = await saveProject(project, baseRevision, { force: opts.force });
      // Keep edits made while the save was in flight.
      const cur = get().project!;
      const changedMeanwhile = cur !== project;
      set({
        project: { ...cur, revision: saved.revision, updatedAt: saved.updatedAt },
        baseRevision: saved.revision,
        dirty: changedMeanwhile,
        saveStatus: 'saved',
        lastSavedAt: saved.updatedAt,
        conflict: undefined,
      });
      if (!opts.silent) get().toast({ kind: 'success', text: 'Projet enregistré.' });
      return true;
    } catch (e) {
      if (e instanceof ConflictError) {
        set({ saveStatus: 'conflict', conflict: e.remote, saveError: e.message });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        set({ saveStatus: 'error', saveError: msg });
        get().toast({ kind: 'error', text: `Échec de l’enregistrement : ${msg}`, actionLabel: 'Réessayer', onAction: () => void get().save() });
      }
      return false;
    }
  },

  async publish() {
    const st = get();
    if (!st.project || st.readOnly) return;
    // 1) save pending edits, 2) publish exactly that saved revision.
    if (st.dirty || st.saveStatus === 'error') {
      const ok = await get().save({ silent: true });
      if (!ok) {
        get().toast({ kind: 'error', text: 'Publication annulée : l’enregistrement a échoué.' });
        return;
      }
    }
    try {
      const pub = await publishProject(get().project!.id, get().baseRevision);
      set({
        project: { ...get().project!, status: pub.status, publishedRevision: pub.publishedRevision, publishedAt: pub.publishedAt, visibility: pub.visibility },
      });
      get().toast({ kind: 'success', text: 'Visite publiée : la version en ligne est à jour.' });
    } catch (e) {
      if (e instanceof ConflictError) {
        set({ saveStatus: 'conflict', conflict: e.remote, saveError: e.message });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      get().toast({ kind: 'error', text: `Échec de la publication : ${msg}`, actionLabel: 'Réessayer', onAction: () => void get().publish() });
    }
  },

  async resolveConflict(choice) {
    const remote = get().conflict;
    if (!remote) return;
    if (choice === 'reload') {
      await get().init(remote);
      get().toast({ kind: 'info', text: 'Version la plus récente rechargée.' });
    } else {
      await get().save({ force: true });
    }
  },

  setAutosave(seconds) {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, settings: { ...p.settings, autosaveSeconds: seconds } }, dirty: true });
  },

  setTool: (tool) => set({ tool }),
  setSnap: (s) => set({ snap: { ...get().snap, ...s } }),
  setOverlay: (k, v) => set({ overlays: { ...get().overlays, [k]: v } }),
  setViewMode: (viewMode) => set({ viewMode, selection: viewMode === 'visitor' ? [] : get().selection }),
  togglePanel: (k, v) => set({ panels: { ...get().panels, [k]: v ?? !get().panels[k] } }),
  toast(t) {
    const id = uid('tst');
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismissToast(id), t.kind === 'error' ? 8000 : 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  confirm(r) {
    return new Promise<boolean>((resolve) => {
      set({
        confirmRequest: {
          ...r,
          resolve: (ok) => {
            set({ confirmRequest: null });
            resolve(ok);
          },
        },
      });
    });
  },
  requestFocus: () => set({ focusRequest: get().focusRequest + 1 }),
}));

export const selectSceneObjects = (s: EditorState) =>
  s.project?.objects.filter((o) => o.sceneId === s.activeSceneId) ?? [];
