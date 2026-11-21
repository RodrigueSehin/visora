import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import { addConnection, addHotspot, addScene, homeSceneId, reorderScene, updateNavLink, updateScene } from '../src/store/tourActions';
import { navigationQuality, tourQuality } from '../src/studio/tour/quality';

setBackend(localBackend);
const st = () => useEditor.getState();
const p = () => st().project!;
const order = () => [...p().scenes].sort((a, b) => a.order - b.order).map((s) => s.id);

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('scene order', () => {
  it('moves a scene to any position, clamps out-of-range targets and is undoable', () => {
    const before = order();
    const last = before[before.length - 1];
    reorderScene(last, 0);
    expect(order()[0]).toBe(last);
    expect(order().slice(1)).toEqual(before.slice(0, -1));
    reorderScene(last, 99);
    expect(order()).toEqual(before);
    st().undo();
    expect(order()[0]).toBe(last);
  });

  it('does not change the home scene when another scene moves to the top', () => {
    const home = order()[0];
    const last = order()[order().length - 1];
    reorderScene(last, 0);
    expect(homeSceneId(p())).toBe(home);
  });
});

describe('scene metadata', () => {
  it('keeps thumbnail, icon, tags and camera lock in the saved document', async () => {
    const id = st().activeSceneId;
    updateScene(id, { thumbnailFileId: 'file-1', icon: 'truck', tags: ['Quai', 'Logistique'], lockCamera: true });
    expect(await st().save({ silent: true })).toBe(true);
    const saved = (await localBackend.loadProject(p().id))!.scenes.find((s) => s.id === id)!;
    expect(saved).toMatchObject({ thumbnailFileId: 'file-1', icon: 'truck', tags: ['Quai', 'Logistique'], lockCamera: true });
  });
});

describe('visit quality', () => {
  it('is computed from real gaps and improves when they are fixed', () => {
    const scored = () => tourQuality(p());
    const failing = (id: string) => !scored().checks.find((c) => c.id === id)!.ok;
    const home = st().activeSceneId;
    const other = addScene('environment');
    // The new scene cannot be reached from the home scene.
    expect(failing('reach')).toBe(true);
    const before = scored().score;
    // The starter project has several unconnected scenes: link them all from the home scene.
    for (const s of p().scenes) if (s.id !== home) addConnection(home, s.id, true);
    expect(failing('reach')).toBe(false);
    expect(other).toBeTruthy();
    expect(scored().score).toBeGreaterThan(before);
    // An incomplete hotspot (video without media) is reported.
    addHotspot('video', home);
    expect(failing('hotspots')).toBe(true);
    // Descriptions and thumbnails on every visible scene.
    for (const s of p().scenes) updateScene(s.id, { description: 'Zone', thumbnailFileId: 'img' });
    expect(failing('desc')).toBe(false);
    expect(failing('thumb')).toBe(false);
    expect(scored().score).toBeLessThan(100);
  });
});

describe('navigation quality and markers', () => {
  it('flags dead ends and keeps marker settings in sync on both directions', () => {
    const ids = order();
    const exitsOk = () => navigationQuality(p()).checks.find((c) => c.id === 'exits')!.ok;
    expect(exitsOk()).toBe(false);
    const first = addConnection(ids[0], ids[1], true)!;
    for (let i = 1; i < ids.length - 1; i++) addConnection(ids[i], ids[i + 1], true);
    expect(exitsOk()).toBe(true);
    expect(navigationQuality(p()).score).toBe(100);
    updateNavLink(first, { showTarget: false });
    const pair = p().navigation!.filter((n) => n.pairId === p().navigation!.find((x) => x.id === first)!.pairId);
    expect(pair).toHaveLength(2);
    expect(pair.every((n) => n.showTarget === false)).toBe(true);
  });
});
