// Scenes, hotspots and navigation commands. Every change goes through `apply` (undo/redo).
import { nowIso, uid } from '../lib/ids';
import type { Annotation, Appearance, Hotspot, HotspotType, NavLink, Scene, SceneObject3D, Vec3 } from '../types';
import { useEditor } from './editor';

const st = () => useEditor.getState();

export const HOTSPOT_TYPES: { id: HotspotType; label: string; color: string; needsMedia?: 'video' | 'document' | 'image' }[] = [
  { id: 'info', label: 'Information', color: '#2F80ED' },
  { id: 'video', label: 'Vidéo', color: '#7868F5', needsMedia: 'video' },
  { id: 'document', label: 'Document', color: '#14B8A6', needsMedia: 'document' },
  { id: 'scene', label: 'Navigation', color: '#F97316' },
  { id: 'equipment', label: 'Équipement', color: '#EC4899' },
  { id: 'link', label: 'Lien web', color: '#64748B' },
  { id: 'form', label: 'Formulaire', color: '#8B5CF6' },
  { id: 'contact', label: 'Contact', color: '#22C55E' },
  { id: 'image', label: 'Image', color: '#0EA5E9', needsMedia: 'image' },
];
export const hotspotMeta = (t: HotspotType) => HOTSPOT_TYPES.find((h) => h.id === t) ?? HOTSPOT_TYPES[0];

/** Default position in front of the visitor start point (re-placed by clicking in the viewport). */
function defaultPosition(scene: Scene | undefined, index: number): Vec3 {
  if (scene?.kind === 'panorama') {
    const a = ((index * 37) % 360) * (Math.PI / 180);
    return { x: +(Math.sin(a) * 8).toFixed(3), y: 0, z: +(-Math.cos(a) * 8).toFixed(3) };
  }
  return { x: +(((index % 5) - 2) * 1.5).toFixed(3), y: 1.6, z: 0 };
}

// ---------- Scenes ----------

export function addScene(kind: 'environment' | 'panorama', opts: { name?: string; panoramaFileId?: string } = {}) {
  const p = st().project;
  if (!p) return undefined;
  const scene: Scene = {
    id: uid('scn'),
    name: opts.name?.trim() || (kind === 'panorama' ? `Panorama ${p.scenes.length + 1}` : `Scène ${p.scenes.length + 1}`),
    kind,
    environment: kind === 'panorama' ? 'empty' : 'warehouse',
    size: kind === 'panorama' ? { width: 20, depth: 20, height: 6 } : { width: 30, depth: 24, height: 9 },
    order: Math.max(-1, ...p.scenes.map((s) => s.order)) + 1,
    panoramaFileId: opts.panoramaFileId,
    initialView: { yaw: 0, pitch: 0, fov: 70 },
  };
  st().apply('Ajouter une scène', (d) => ({ ...d, scenes: [...d.scenes, scene] }));
  st().setActiveScene(scene.id);
  return scene.id;
}

export function updateScene(id: string, patch: Partial<Scene>, label = 'Modifier la scène', coalesceKey?: string) {
  st().apply(label, (d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }), coalesceKey);
}

/** Copies the scene with its objects and hotspots (navigation points are not copied: they target specific scenes). */
export function duplicateScene(id: string) {
  const p = st().project;
  const src = p?.scenes.find((s) => s.id === id);
  if (!p || !src) return;
  const copy: Scene = { ...src, id: uid('scn'), name: `${src.name} (copie)`, order: src.order + 0.5 };
  const idMap = new Map<string, string>();
  for (const o of p.objects) if (o.sceneId === id) idMap.set(o.id, uid('obj'));
  const t = nowIso();
  const objects: SceneObject3D[] = p.objects
    .filter((o) => o.sceneId === id)
    .map((o) => ({ ...o, id: idMap.get(o.id)!, sceneId: copy.id, parentId: o.parentId ? idMap.get(o.parentId) : undefined, createdAt: t, updatedAt: t }));
  const hotspots: Hotspot[] = (p.hotspots ?? []).filter((h) => h.sceneId === id).map((h) => ({ ...h, id: uid('hs'), sceneId: copy.id }));
  st().apply('Dupliquer la scène', (d) => ({
    ...d,
    scenes: [...d.scenes, copy].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i })),
    objects: [...d.objects, ...objects],
    hotspots: [...(d.hotspots ?? []), ...hotspots],
  }));
  st().setActiveScene(copy.id);
}

export function moveScene(id: string, dir: -1 | 1) {
  const p = st().project;
  if (!p) return;
  const sorted = [...p.scenes].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  const order = new Map(sorted.map((s, k) => [s.id, k]));
  // Reordering never changes the home scene implicitly (it defaults to the first scene).
  const home = homeSceneId(p);
  st().apply('Réorganiser les scènes', (d) => ({ ...d, settings: { ...d.settings, homeSceneId: home }, scenes: d.scenes.map((s) => ({ ...s, order: order.get(s.id)! })) }));
}

/** Moves a scene to a position (0-based) in the visit order. */
export function reorderScene(id: string, toIndex: number) {
  const p = st().project;
  if (!p) return;
  const sorted = [...p.scenes].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((s) => s.id === id);
  const j = Math.max(0, Math.min(sorted.length - 1, Math.round(toIndex)));
  if (i < 0 || i === j) return;
  const [moved] = sorted.splice(i, 1);
  sorted.splice(j, 0, moved);
  const order = new Map(sorted.map((s, k) => [s.id, k]));
  // Reordering never changes the home scene implicitly (it defaults to the first scene).
  const home = homeSceneId(p);
  st().apply('Réorganiser les scènes', (d) => ({ ...d, settings: { ...d.settings, homeSceneId: home }, scenes: d.scenes.map((s) => ({ ...s, order: order.get(s.id)! })) }));
}

export function setHomeScene(id: string) {
  st().apply('Définir la scène d’accueil', (d) => ({ ...d, settings: { ...d.settings, homeSceneId: id } }));
}

export const homeSceneId = (p: { scenes: Scene[]; settings: { homeSceneId?: string } }) =>
  p.settings.homeSceneId && p.scenes.some((s) => s.id === p.settings.homeSceneId) ? p.settings.homeSceneId : [...p.scenes].sort((a, b) => a.order - b.order)[0]?.id;

/** Deletes a scene with its objects, hotspots and every navigation point to or from it. */
export function deleteSceneDeep(id: string) {
  const p = st().project;
  if (!p) return;
  if (p.scenes.length <= 1) return st().toast({ kind: 'warning', text: 'Un projet doit conserver au moins une scène.' });
  st().apply('Supprimer la scène', (d) => ({
    ...d,
    scenes: d.scenes.filter((s) => s.id !== id),
    objects: d.objects.filter((o) => o.sceneId !== id),
    hotspots: (d.hotspots ?? []).filter((h) => h.sceneId !== id && h.targetSceneId !== id),
    annotations: (d.annotations ?? []).filter((a) => a.sceneId !== id),
    navigation: (d.navigation ?? []).filter((n) => n.sceneId !== id && n.targetSceneId !== id),
    floorPlans: (d.floorPlans ?? []).map((f) => {
      const gone = new Set((d.hotspots ?? []).filter((h) => h.sceneId === id || h.targetSceneId === id).map((h) => h.id));
      return { ...f, markers: f.markers.filter((m) => m.sceneId !== id), hotspotPins: (f.hotspotPins ?? []).filter((p) => !gone.has(p.hotspotId)) };
    }),
    guidedTours: (d.guidedTours ?? []).map((t) => ({ ...t, steps: t.steps.filter((s) => s.sceneId !== id) })),
    settings: d.settings.homeSceneId === id ? { ...d.settings, homeSceneId: undefined } : d.settings,
  }));
  if (st().activeSceneId === id) st().setActiveScene(homeSceneId(st().project!)!);
}

// ---------- Hotspots ----------

export function addHotspot(type: HotspotType, sceneId = st().activeSceneId) {
  const p = st().project;
  if (!p) return undefined;
  const scene = p.scenes.find((s) => s.id === sceneId);
  const count = (p.hotspots ?? []).filter((h) => h.sceneId === sceneId).length;
  const h: Hotspot = {
    id: uid('hs'),
    sceneId,
    type,
    title: `${hotspotMeta(type).label} ${count + 1}`,
    position: defaultPosition(scene, count),
    showLabel: true,
    size: 1,
    ...(type === 'form' ? { form: { fields: ['name', 'email', 'message'] } } : {}),
    ...(type === 'equipment' ? { specs: [] } : {}),
  } as Hotspot;
  st().apply('Ajouter un hotspot', (d) => ({ ...d, hotspots: [...(d.hotspots ?? []), h] }));
  st().setFocus({ kind: 'hotspot', id: h.id });
  return h.id;
}

export function updateHotspot(id: string, patch: Partial<Hotspot>, label = 'Modifier le hotspot', coalesceKey?: string) {
  st().apply(label, (d) => ({ ...d, hotspots: (d.hotspots ?? []).map((h) => (h.id === id ? { ...h, ...patch } : h)) }), coalesceKey);
}

export function duplicateHotspot(id: string) {
  const h = st().project?.hotspots?.find((x) => x.id === id);
  if (!h) return;
  const copy: Hotspot = { ...h, id: uid('hs'), title: `${h.title} (copie)`, position: { ...h.position, x: h.position.x + 0.5 } };
  st().apply('Dupliquer le hotspot', (d) => ({ ...d, hotspots: [...(d.hotspots ?? []), copy] }));
  st().setFocus({ kind: 'hotspot', id: copy.id });
}

export function removeHotspot(id: string) {
  st().apply('Supprimer le hotspot', (d) => ({
    ...d,
    hotspots: (d.hotspots ?? []).filter((h) => h.id !== id),
    floorPlans: (d.floorPlans ?? []).map((f) => (f.hotspotPins?.some((p) => p.hotspotId === id) ? { ...f, hotspotPins: f.hotspotPins.filter((p) => p.hotspotId !== id) } : f)),
  }));
  if (st().focus?.id === id) st().setFocus(null);
}

// ---------- Navigation ----------

export function addConnection(fromId: string, toId: string, bidirectional: boolean) {
  const p = st().project;
  if (!p || fromId === toId) return undefined;
  const pairId = bidirectional ? uid('pair') : undefined;
  const make = (sceneId: string, targetSceneId: string): NavLink => {
    const scene = p.scenes.find((s) => s.id === sceneId);
    const count = (p.navigation ?? []).filter((n) => n.sceneId === sceneId).length;
    const pos = defaultPosition(scene, count + 3);
    return { id: uid('nav'), sceneId, targetSceneId, position: { ...pos, y: scene?.kind === 'panorama' ? -1.5 : 0.05 }, pairId, transition: 'fade', durationMs: 800, showArrow: true };
  };
  const links = [make(fromId, toId), ...(bidirectional ? [make(toId, fromId)] : [])];
  st().apply(bidirectional ? 'Ajouter une connexion bidirectionnelle' : 'Ajouter une connexion', (d) => ({ ...d, navigation: [...(d.navigation ?? []), ...links] }));
  st().setFocus({ kind: 'nav', id: links[0].id });
  return links[0].id;
}

/** Settings shared by both directions of a pair (transition, arrow) are kept in sync. */
export function updateNavLink(id: string, patch: Partial<NavLink>, label = 'Modifier la connexion', coalesceKey?: string) {
  const link = st().project?.navigation?.find((n) => n.id === id);
  if (!link) return;
  const shared: Partial<NavLink> = {};
  for (const k of ['transition', 'durationMs', 'showArrow', 'showTarget'] as const) if (k in patch) (shared as Record<string, unknown>)[k] = patch[k];
  st().apply(
    label,
    (d) => ({
      ...d,
      navigation: (d.navigation ?? []).map((n) => (n.id === id ? { ...n, ...patch } : link.pairId && n.pairId === link.pairId ? { ...n, ...shared } : n)),
    }),
    coalesceKey,
  );
}

/** Makes a one-way connection two-way (adds the return point) or the reverse. */
export function setBidirectional(id: string, on: boolean) {
  const p = st().project;
  const link = p?.navigation?.find((n) => n.id === id);
  if (!p || !link) return;
  if (on && !link.pairId) {
    const pairId = uid('pair');
    const target = p.scenes.find((s) => s.id === link.targetSceneId);
    const back: NavLink = { ...link, id: uid('nav'), sceneId: link.targetSceneId, targetSceneId: link.sceneId, pairId, label: undefined, position: { ...defaultPosition(target, 5), y: target?.kind === 'panorama' ? -1.5 : 0.05 } };
    st().apply('Autoriser le retour', (d) => ({ ...d, navigation: [...(d.navigation ?? []).map((n) => (n.id === id ? { ...n, pairId } : n)), back] }));
  } else if (!on && link.pairId) {
    st().apply('Supprimer le retour', (d) => ({
      ...d,
      navigation: (d.navigation ?? []).filter((n) => n.id === id || n.pairId !== link.pairId).map((n) => (n.id === id ? { ...n, pairId: undefined } : n)),
    }));
  }
}

/** Removes the point and, for a two-way connection, its return point. */
export function removeConnection(id: string) {
  const link = st().project?.navigation?.find((n) => n.id === id);
  if (!link) return;
  st().apply('Supprimer la connexion', (d) => ({ ...d, navigation: (d.navigation ?? []).filter((n) => n.id !== id && !(link.pairId && n.pairId === link.pairId)) }));
  st().setFocus(null);
}

/** Scenes that cannot be reached from the home scene by following navigation points. */
export function unreachableScenes(p: { scenes: Scene[]; navigation?: NavLink[]; settings: { homeSceneId?: string } }): string[] {
  const home = homeSceneId(p);
  if (!home) return [];
  const seen = new Set([home]);
  const queue = [home];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of p.navigation ?? []) if (n.sceneId === cur && !seen.has(n.targetSceneId)) {
      seen.add(n.targetSceneId);
      queue.push(n.targetSceneId);
    }
  }
  return p.scenes.filter((s) => !seen.has(s.id) && !s.hidden).map((s) => s.id);
}

export function setPosition(focus: { kind: 'hotspot' | 'nav' | 'annotation'; id: string }, position: Vec3) {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const pos = { x: r(position.x), y: r(position.y), z: r(position.z) };
  if (focus.kind === 'annotation') updateAnnotation(focus.id, { position: pos }, 'Placer l’annotation');
  else if (focus.kind === 'hotspot') updateHotspot(focus.id, { position: pos }, 'Placer le hotspot');
  else updateNavLink(focus.id, { position: pos }, 'Placer le point de navigation');
}

// ---------- Annotations ----------

export function addAnnotation(sceneId = st().activeSceneId) {
  const p = st().project;
  if (!p) return undefined;
  const scene = p.scenes.find((s) => s.id === sceneId);
  const count = (p.annotations ?? []).filter((a) => a.sceneId === sceneId).length;
  const a: Annotation = { id: uid('note'), sceneId, text: 'Nouvelle note', position: defaultPosition(scene, count + 7), visibility: 'studio', color: '#F59E0B' };
  st().apply('Ajouter une annotation', (d) => ({ ...d, annotations: [...(d.annotations ?? []), a] }));
  st().setFocus({ kind: 'annotation', id: a.id });
  return a.id;
}

export function updateAnnotation(id: string, patch: Partial<Annotation>, label = 'Modifier l’annotation') {
  st().apply(label, (d) => ({ ...d, annotations: (d.annotations ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
}

export function removeAnnotation(id: string) {
  st().apply('Supprimer l’annotation', (d) => ({ ...d, annotations: (d.annotations ?? []).filter((a) => a.id !== id) }));
  if (st().focus?.id === id) st().setFocus(null);
}

export function updateAppearance(patch: Partial<Appearance>, label = 'Modifier l’apparence', coalesceKey?: string) {
  st().apply(label, (d) => ({ ...d, settings: { ...d.settings, appearance: { ...d.settings.appearance, ...patch } } }), coalesceKey);
}
