// Floor plans and guided tours. Every change goes through `apply` (undo/redo).
import { uid } from '../lib/ids';
import type { FloorPlan, GuidedTour, PlanHotspotPin, PlanMarker, PlanPoint, PlanZone, SceneView, TourStep } from '../types';
import { useEditor } from './editor';

const st = () => useEditor.getState();
const r4 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;

// ---------- Measurement (pure) ----------

/**
 * Distance between two plan points in "plan width" units. Points are normalized to the image,
 * so the vertical axis is rescaled by the image aspect ratio (height / width).
 */
export function planDistance(a: PlanPoint, b: PlanPoint, aspect: number): number {
  return Math.hypot(b.x - a.x, (b.y - a.y) * aspect);
}

/** Real distance in metres, or null when the plan is not calibrated (never guessed). */
export function measureMeters(plan: Pick<FloorPlan, 'calibration'>, a: PlanPoint, b: PlanPoint, aspect: number): number | null {
  const c = plan.calibration;
  if (!c) return null;
  const ref = planDistance(c.a, c.b, aspect);
  if (ref <= 0 || c.meters <= 0) return null;
  return (planDistance(a, b, aspect) / ref) * c.meters;
}

// ---------- Plans ----------

export function addPlan(name?: string, imageFileId?: string) {
  const p = st().project;
  if (!p) return undefined;
  const plans = p.floorPlans ?? [];
  const plan: FloorPlan = {
    id: uid('plan'),
    name: name?.trim() || (plans.length ? `Étage ${plans.length}` : 'Rez-de-chaussée'),
    imageFileId,
    order: plans.length,
    markers: [],
    texts: [],
  };
  st().apply('Ajouter un plan', (d) => ({ ...d, floorPlans: [...(d.floorPlans ?? []), plan] }));
  return plan.id;
}

export function updatePlan(id: string, patch: Partial<FloorPlan>, label = 'Modifier le plan') {
  st().apply(label, (d) => ({ ...d, floorPlans: (d.floorPlans ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
}

export function removePlan(id: string) {
  st().apply('Supprimer le plan', (d) => ({ ...d, floorPlans: (d.floorPlans ?? []).filter((f) => f.id !== id) }));
}

/** Places (or moves) a scene on a plan. A scene appears on at most one plan. */
export function placeSceneOnPlan(planId: string, sceneId: string, at: PlanPoint) {
  const pt = { x: r4(at.x), y: r4(at.y) };
  st().apply('Placer la scène sur le plan', (d) => ({
    ...d,
    floorPlans: (d.floorPlans ?? []).map((f) => {
      const markers = f.markers.filter((m) => m.sceneId !== sceneId);
      return f.id === planId ? { ...f, markers: [...markers, { sceneId, ...pt }] } : { ...f, markers };
    }),
  }));
}

export function removeSceneFromPlan(planId: string, sceneId: string) {
  st().apply('Retirer la scène du plan', (d) => ({
    ...d,
    floorPlans: (d.floorPlans ?? []).map((f) => (f.id === planId ? { ...f, markers: f.markers.filter((m) => m.sceneId !== sceneId) } : f)),
  }));
}

export function addPlanText(planId: string, at: PlanPoint, text = 'Texte') {
  const t = { id: uid('txt'), x: r4(at.x), y: r4(at.y), text };
  st().apply('Ajouter un texte', (d) => ({ ...d, floorPlans: (d.floorPlans ?? []).map((f) => (f.id === planId ? { ...f, texts: [...f.texts, t] } : f)) }));
  return t.id;
}

export function updatePlanText(planId: string, id: string, patch: Partial<{ x: number; y: number; text: string }>, label = 'Modifier le texte') {
  const clean = { ...patch, ...(patch.x !== undefined && { x: r4(patch.x) }), ...(patch.y !== undefined && { y: r4(patch.y) }) };
  st().apply(label, (d) => ({
    ...d,
    floorPlans: (d.floorPlans ?? []).map((f) => (f.id === planId ? { ...f, texts: f.texts.map((t) => (t.id === id ? { ...t, ...clean } : t)) } : f)),
  }));
}

export function removePlanText(planId: string, id: string) {
  st().apply('Supprimer le texte', (d) => ({ ...d, floorPlans: (d.floorPlans ?? []).map((f) => (f.id === planId ? { ...f, texts: f.texts.filter((t) => t.id !== id) } : f)) }));
}

const mapPlan = (planId: string, fn: (f: FloorPlan) => FloorPlan) => (d: { floorPlans?: FloorPlan[] }) => ({ ...d, floorPlans: (d.floorPlans ?? []).map((f) => (f.id === planId ? fn(f) : f)) });

export function updateMarker(planId: string, sceneId: string, patch: Partial<Omit<PlanMarker, 'sceneId'>>, label = 'Modifier le point') {
  st().apply(label, (d) => mapPlan(planId, (f) => ({ ...f, markers: f.markers.map((m) => (m.sceneId === sceneId ? { ...m, ...patch } : m)) }))(d) as typeof d);
}

/** Points a plan marker to another scene (the other scene leaves any plan it was on). */
export function reassignMarker(planId: string, fromSceneId: string, toSceneId: string) {
  if (fromSceneId === toSceneId) return;
  st().apply('Changer la scène du point', (d) => ({
    ...d,
    floorPlans: (d.floorPlans ?? []).map((f) => {
      const markers = f.markers.filter((m) => m.sceneId !== toSceneId);
      return f.id === planId ? { ...f, markers: markers.map((m) => (m.sceneId === fromSceneId ? { ...m, sceneId: toSceneId } : m)) } : { ...f, markers };
    }),
  }));
}

export function addHotspotPin(planId: string, hotspotId: string, at: PlanPoint) {
  const pin: PlanHotspotPin = { id: uid('pin'), hotspotId, x: r4(at.x), y: r4(at.y) };
  st().apply('Épingler un hotspot', (d) => mapPlan(planId, (f) => ({ ...f, hotspotPins: [...(f.hotspotPins ?? []).filter((p) => p.hotspotId !== hotspotId), pin] }))(d) as typeof d);
  return pin.id;
}

export function updateHotspotPin(planId: string, id: string, patch: Partial<Omit<PlanHotspotPin, 'id'>>, label = 'Déplacer l’épingle') {
  const clean = { ...patch, ...(patch.x !== undefined && { x: r4(patch.x) }), ...(patch.y !== undefined && { y: r4(patch.y) }) };
  st().apply(label, (d) => mapPlan(planId, (f) => ({ ...f, hotspotPins: (f.hotspotPins ?? []).map((p) => (p.id === id ? { ...p, ...clean } : p)) }))(d) as typeof d);
}

export function removeHotspotPin(planId: string, id: string) {
  st().apply('Retirer l’épingle', (d) => mapPlan(planId, (f) => ({ ...f, hotspotPins: (f.hotspotPins ?? []).filter((p) => p.id !== id) }))(d) as typeof d);
}

/** Zone from two opposite corners (any drag direction). */
export function addZone(planId: string, a: PlanPoint, b: PlanPoint, label = 'Zone') {
  const z: PlanZone = { id: uid('zone'), x: r4(Math.min(a.x, b.x)), y: r4(Math.min(a.y, b.y)), w: r4(Math.abs(b.x - a.x)), h: r4(Math.abs(b.y - a.y)), label, color: '#7868F5' };
  if (z.w < 0.01 || z.h < 0.01) return undefined;
  st().apply('Ajouter une zone', (d) => mapPlan(planId, (f) => ({ ...f, zones: [...(f.zones ?? []), z] }))(d) as typeof d);
  return z.id;
}

export function updateZone(planId: string, id: string, patch: Partial<Omit<PlanZone, 'id'>>, label = 'Modifier la zone') {
  st().apply(label, (d) => mapPlan(planId, (f) => ({ ...f, zones: (f.zones ?? []).map((z) => (z.id === id ? { ...z, ...patch } : z)) }))(d) as typeof d);
}

export function removeZone(planId: string, id: string) {
  st().apply('Supprimer la zone', (d) => mapPlan(planId, (f) => ({ ...f, zones: (f.zones ?? []).filter((z) => z.id !== id) }))(d) as typeof d);
}

export function calibratePlan(planId: string, a: PlanPoint, b: PlanPoint, meters: number) {
  if (!(meters > 0)) return;
  updatePlan(planId, { calibration: { a: { x: r4(a.x), y: r4(a.y) }, b: { x: r4(b.x), y: r4(b.y) }, meters } }, 'Calibrer le plan');
}

// ---------- Guided tours ----------

export function addGuidedTour(name?: string) {
  const p = st().project;
  if (!p) return undefined;
  const t: GuidedTour = { id: uid('gt'), name: name?.trim() || `Parcours ${(p.guidedTours ?? []).length + 1}`, steps: [] };
  st().apply('Créer un parcours guidé', (d) => ({ ...d, guidedTours: [...(d.guidedTours ?? []), t] }));
  return t.id;
}

const mapTour = (tourId: string, fn: (t: GuidedTour) => GuidedTour) => (d: ReturnType<typeof st>['project'] & object) => ({
  ...d,
  guidedTours: (d.guidedTours ?? []).map((t) => (t.id === tourId ? fn(t) : t)),
});

export function renameGuidedTour(id: string, name: string) {
  if (name.trim()) st().apply('Renommer le parcours', mapTour(id, (t) => ({ ...t, name: name.trim() })));
}

export function removeGuidedTour(id: string) {
  st().apply('Supprimer le parcours', (d) => ({ ...d, guidedTours: (d.guidedTours ?? []).filter((t) => t.id !== id) }));
}

/** Adds a step on the active scene, optionally capturing the current camera view. */
export function addStep(tourId: string, view?: SceneView | null) {
  const s = st();
  const scene = s.project?.scenes.find((x) => x.id === s.activeSceneId);
  if (!scene) return undefined;
  const step: TourStep = { id: uid('step'), sceneId: scene.id, title: scene.name, view: view ?? scene.initialView, durationS: 8 };
  st().apply('Ajouter une étape', mapTour(tourId, (t) => ({ ...t, steps: [...t.steps, step] })));
  return step.id;
}

export function updateStep(tourId: string, stepId: string, patch: Partial<TourStep>, label = 'Modifier l’étape') {
  st().apply(label, mapTour(tourId, (t) => ({ ...t, steps: t.steps.map((x) => (x.id === stepId ? { ...x, ...patch } : x)) })));
}

export function moveStep(tourId: string, stepId: string, dir: -1 | 1) {
  st().apply(
    'Réorganiser les étapes',
    mapTour(tourId, (t) => {
      const steps = [...t.steps];
      const i = steps.findIndex((x) => x.id === stepId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= steps.length) return t;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...t, steps };
    }),
  );
}

export function removeStep(tourId: string, stepId: string) {
  st().apply('Supprimer l’étape', mapTour(tourId, (t) => ({ ...t, steps: t.steps.filter((x) => x.id !== stepId) })));
}

/** Steps whose scene no longer exists or is hidden (they would break playback). */
export function brokenSteps(t: GuidedTour, scenes: { id: string; hidden?: boolean }[]): string[] {
  return t.steps.filter((s) => !scenes.some((x) => x.id === s.sceneId && !x.hidden)).map((s) => s.id);
}
