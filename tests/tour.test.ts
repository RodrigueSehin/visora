import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import {
  addConnection,
  addHotspot,
  addScene,
  deleteSceneDeep,
  duplicateScene,
  homeSceneId,
  moveScene,
  removeConnection,
  setBidirectional,
  setHomeScene,
  setPosition,
  unreachableScenes,
  updateHotspot,
  updateNavLink,
} from '../src/store/tourActions';
import { hotspotProblem } from '../src/studio/tour/HotspotsModule';

setBackend(localBackend);
const st = () => useEditor.getState();
const p = () => st().project!;
const sceneIds = () => [...p().scenes].sort((a, b) => a.order - b.order).map((s) => s.id);

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('scenes', () => {
  it('adds a 360° scene, makes it home and opens on it', async () => {
    const id = addScene('panorama', { panoramaFileId: 'file_pano', name: 'Hall 360' })!;
    const s = p().scenes.find((x) => x.id === id)!;
    expect(s.kind).toBe('panorama');
    expect(s.panoramaFileId).toBe('file_pano');
    expect(st().activeSceneId).toBe(id);
    setHomeScene(id);
    expect(homeSceneId(p())).toBe(id);
    // Reopening the project starts on the home scene.
    await st().init(p());
    expect(st().activeSceneId).toBe(id);
  });

  it('reorders and duplicates scenes with their objects and hotspots', () => {
    const [a, b] = sceneIds();
    moveScene(b, -1);
    expect(sceneIds().slice(0, 2)).toEqual([b, a]);
    st().setActiveScene(a);
    st().addObject('builtin:cone');
    addHotspot('info', a);
    duplicateScene(a);
    const copy = st().activeSceneId;
    expect(copy).not.toBe(a);
    expect(p().objects.filter((o) => o.sceneId === copy)).toHaveLength(1);
    expect(p().hotspots!.filter((h) => h.sceneId === copy)).toHaveLength(1);
  });
});

describe('navigation', () => {
  it('creates two-way connections as a pair and keeps shared settings in sync', () => {
    const [a, b] = sceneIds();
    const id = addConnection(a, b, true)!;
    const nav = p().navigation!;
    expect(nav).toHaveLength(2);
    expect(nav[0].pairId).toBeDefined();
    expect(nav[0].pairId).toBe(nav[1].pairId);
    expect(nav.map((n) => [n.sceneId, n.targetSceneId])).toEqual([
      [a, b],
      [b, a],
    ]);
    updateNavLink(id, { transition: 'none', label: 'Vers le stock' });
    const back = p().navigation!.find((n) => n.id !== id)!;
    expect(back.transition).toBe('none'); // shared
    expect(back.label).toBeUndefined(); // own
    setBidirectional(id, false);
    expect(p().navigation).toHaveLength(1);
    setBidirectional(id, true);
    expect(p().navigation).toHaveLength(2);
    removeConnection(id);
    expect(p().navigation).toHaveLength(0);
  });

  it('detects scenes unreachable from the home scene', () => {
    const [a, b, c, d] = sceneIds();
    expect(unreachableScenes(p()).sort()).toEqual([b, c, d].sort());
    addConnection(a, b, false);
    addConnection(b, c, false);
    expect(unreachableScenes(p())).toEqual([d]);
    // A hidden scene is not reported.
    useEditor.getState().apply('hide', (doc) => ({ ...doc, scenes: doc.scenes.map((s) => (s.id === d ? { ...s, hidden: true } : s)) }));
    expect(unreachableScenes(p())).toEqual([]);
  });

  it('deletes a scene with everything pointing to it, undoably', () => {
    const [a, b] = sceneIds();
    addConnection(a, b, true);
    const h = addHotspot('scene', a)!;
    updateHotspot(h, { targetSceneId: b });
    st().setActiveScene(b);
    st().addObject('builtin:pallet');
    deleteSceneDeep(b);
    expect(p().scenes.some((s) => s.id === b)).toBe(false);
    expect(p().navigation).toHaveLength(0);
    expect(p().hotspots).toHaveLength(0);
    expect(p().objects).toHaveLength(0);
    st().undo();
    expect(p().navigation).toHaveLength(2);
    expect(p().hotspots).toHaveLength(1);
    expect(p().objects).toHaveLength(1);
  });
});

describe('hotspots', () => {
  it('adds, positions, validates and persists hotspots and navigation', async () => {
    const [a, b] = sceneIds();
    const h = addHotspot('video', a)!;
    expect(st().focus).toEqual({ kind: 'hotspot', id: h });
    setPosition({ kind: 'hotspot', id: h }, { x: 1.23456, y: 2, z: -3 });
    expect(p().hotspots![0].position).toEqual({ x: 1.235, y: 2, z: -3 });
    expect(hotspotProblem(p().hotspots![0])).toMatch(/média/);
    updateHotspot(h, { mediaId: 'file_video' });
    expect(hotspotProblem(p().hotspots![0])).toBeNull();
    expect(hotspotProblem({ ...p().hotspots![0], type: 'link', url: 'javascript:alert(1)' })).toMatch(/invalide/);
    addConnection(a, b, false);
    expect(await st().save({ silent: true })).toBe(true);
    const saved = await localBackend.loadProject(p().id);
    expect(saved?.hotspots?.[0].mediaId).toBe('file_video');
    expect(saved?.navigation).toHaveLength(1);
    // Undo history covers hotspots too.
    st().undo();
    expect(p().navigation).toHaveLength(0);
  });
});
