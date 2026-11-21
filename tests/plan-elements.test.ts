import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import { addHotspotPin, addPlan, addZone, placeSceneOnPlan, reassignMarker, updateMarker, updatePlan } from '../src/store/planActions';
import { addHotspot, deleteSceneDeep, removeHotspot } from '../src/store/tourActions';
import { planQuality } from '../src/studio/tour/quality';

setBackend(localBackend);
const st = () => useEditor.getState();
const p = () => st().project!;
const plan = (id: string) => p().floorPlans!.find((f) => f.id === id)!;
const sceneIds = () => [...p().scenes].sort((a, b) => a.order - b.order).map((s) => s.id);

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('plan elements', () => {
  it('zones are normalized whatever the drag direction, and tiny zones are ignored', () => {
    const id = addPlan()!;
    const z = addZone(id, { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.3 })!;
    expect(plan(id).zones![0]).toMatchObject({ id: z, x: 0.2, y: 0.3, w: 0.4, h: 0.4 });
    expect(addZone(id, { x: 0.5, y: 0.5 }, { x: 0.502, y: 0.6 })).toBeUndefined();
    expect(plan(id).zones).toHaveLength(1);
  });

  it('hotspot pins follow hotspot and scene deletion', () => {
    const id = addPlan()!;
    const [s1, s2] = sceneIds();
    const h1 = addHotspot('info', s1)!;
    const h2 = addHotspot('info', s2)!;
    addHotspotPin(id, h1, { x: 0.1, y: 0.1 });
    addHotspotPin(id, h2, { x: 0.2, y: 0.2 });
    // Pinning the same hotspot again moves the pin instead of duplicating it.
    addHotspotPin(id, h1, { x: 0.3, y: 0.3 });
    expect(plan(id).hotspotPins).toHaveLength(2);
    removeHotspot(h1);
    expect(plan(id).hotspotPins!.map((x) => x.hotspotId)).toEqual([h2]);
    deleteSceneDeep(s2);
    expect(plan(id).hotspotPins).toHaveLength(0);
    st().undo();
    expect(plan(id).hotspotPins).toHaveLength(1);
  });

  it('a marker can be hidden, recoloured and pointed to another scene (which leaves its old plan)', () => {
    const a = addPlan('RDC')!;
    const b = addPlan('Étage 1')!;
    const [s1, s2] = sceneIds();
    placeSceneOnPlan(a, s1, { x: 0.1, y: 0.1 });
    placeSceneOnPlan(b, s2, { x: 0.5, y: 0.5 });
    updateMarker(a, s1, { hidden: true, color: '#DC2626' });
    expect(plan(a).markers[0]).toMatchObject({ sceneId: s1, hidden: true, color: '#DC2626' });
    reassignMarker(a, s1, s2);
    expect(plan(a).markers.map((m) => m.sceneId)).toEqual([s2]);
    expect(plan(b).markers).toHaveLength(0);
  });
});

describe('plan quality', () => {
  it('scores only what is really missing', () => {
    expect(planQuality(p()).checks.find((c) => c.id === 'plan-exists')!.ok).toBe(false);
    const id = addPlan()!;
    const failing = () => planQuality(p()).checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failing()).toEqual(expect.arrayContaining(['plan-image', 'plan-placed']));
    updatePlan(id, { imageFileId: 'img' });
    sceneIds().forEach((s, i) => placeSceneOnPlan(id, s, { x: 0.1 * (i + 1), y: 0.5 }));
    expect(failing()).toEqual(['plan-calibrated']);
    updatePlan(id, { calibration: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, meters: 40 } });
    expect(planQuality(p()).score).toBe(100);
  });
});
