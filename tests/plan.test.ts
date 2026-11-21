import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import {
  addGuidedTour,
  addPlan,
  addPlanText,
  addStep,
  brokenSteps,
  calibratePlan,
  measureMeters,
  moveStep,
  placeSceneOnPlan,
  planDistance,
  updateStep,
} from '../src/store/planActions';
import { deleteSceneDeep } from '../src/store/tourActions';

setBackend(localBackend);
const st = () => useEditor.getState();
const p = () => st().project!;
const scenes = () => [...p().scenes].sort((a, b) => a.order - b.order).map((s) => s.id);

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('measurement', () => {
  it('never reports metres without calibration', () => {
    expect(measureMeters({}, { x: 0, y: 0 }, { x: 1, y: 0 }, 0.5)).toBeNull();
  });

  it('scales distances from the calibration, accounting for the image aspect ratio', () => {
    // Plan 2:1 (aspect 0.5). Calibration: full width = 40 m.
    const plan = { calibration: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, meters: 40 } };
    expect(measureMeters(plan, { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, 0.5)).toBeCloseTo(20);
    // Full height of a 2:1 plan is half the width: 20 m.
    expect(measureMeters(plan, { x: 0, y: 0 }, { x: 0, y: 1 }, 0.5)).toBeCloseTo(20);
    expect(planDistance({ x: 0, y: 0 }, { x: 0.3, y: 0.8 }, 0.5)).toBeCloseTo(0.5);
  });
});

describe('floor plans', () => {
  it('places each scene on a single plan and keeps texts and calibration', () => {
    const [a] = scenes();
    const rdc = addPlan('Rez-de-chaussée')!;
    const r1 = addPlan('Étage 1')!;
    placeSceneOnPlan(rdc, a, { x: 0.2, y: 0.3 });
    placeSceneOnPlan(r1, a, { x: 1.4, y: -1 }); // moved to another floor, clamped to the image
    const plans = p().floorPlans!;
    expect(plans.find((f) => f.id === rdc)!.markers).toHaveLength(0);
    expect(plans.find((f) => f.id === r1)!.markers[0]).toEqual({ sceneId: a, x: 1, y: 0 });
    addPlanText(rdc, { x: 0.5, y: 0.5 }, 'Quai');
    calibratePlan(rdc, { x: 0, y: 0 }, { x: 0.5, y: 0 }, 12.5);
    calibratePlan(rdc, { x: 0, y: 0 }, { x: 0.5, y: 0 }, -3); // ignored
    const f = p().floorPlans!.find((x) => x.id === rdc)!;
    expect(f.texts[0].text).toBe('Quai');
    expect(f.calibration?.meters).toBe(12.5);
  });

  it('removes markers and guided-tour steps with their scene (undoable)', () => {
    const [a, b] = scenes();
    const plan = addPlan()!;
    placeSceneOnPlan(plan, b, { x: 0.5, y: 0.5 });
    const tour = addGuidedTour('Visite express')!;
    st().setActiveScene(b);
    addStep(tour);
    st().setActiveScene(a);
    addStep(tour);
    deleteSceneDeep(b);
    expect(p().floorPlans![0].markers).toHaveLength(0);
    expect(p().guidedTours![0].steps.map((s) => s.sceneId)).toEqual([a]);
    st().undo();
    expect(p().floorPlans![0].markers).toHaveLength(1);
    expect(p().guidedTours![0].steps).toHaveLength(2);
  });
});

describe('guided tours', () => {
  it('builds ordered steps with captured views and flags broken ones', async () => {
    const [a, b] = scenes();
    const tour = addGuidedTour()!;
    st().setActiveScene(a);
    const s1 = addStep(tour, { yaw: 90, pitch: -10, fov: 65 })!;
    st().setActiveScene(b);
    const s2 = addStep(tour)!;
    updateStep(tour, s2, { title: 'Le stock', durationS: 12 });
    moveStep(tour, s2, -1);
    const t = p().guidedTours![0];
    expect(t.steps.map((s) => s.id)).toEqual([s2, s1]);
    expect(t.steps[1].view).toEqual({ yaw: 90, pitch: -10, fov: 65 });
    expect(brokenSteps(t, p().scenes.map((s) => (s.id === b ? { ...s, hidden: true } : s)))).toEqual([s2]);
    expect(await st().save({ silent: true })).toBe(true);
    const saved = await localBackend.loadProject(p().id);
    expect(saved?.guidedTours?.[0].steps[0].title).toBe('Le stock');
  });
});
