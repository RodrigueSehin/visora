import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { decompose, worldMatrix } from '../src/lib/transforms';
import { loadActiveProject } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import { setBackend } from '../src/services/persistence';
import { localBackend } from '../src/services/localBackend';

// Unit tests run the Studio store against the IndexedDB backend (the app uses the API).
setBackend(localBackend);
import type { Asset3D } from '../src/types';

const st = () => useEditor.getState();
const objs = () => st().project!.objects;

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('objects', () => {
  it('adds an object to the active scene and selects it', () => {
    const id = st().addObject('builtin:forklift')!;
    const o = objs().find((x) => x.id === id)!;
    expect(o.sceneId).toBe(st().activeSceneId);
    expect(o.name).toBe('Chariot élévateur');
    expect(st().selection).toEqual([id]);
    expect(st().dirty).toBe(true);
  });

  it('places successive objects on free spots instead of stacking them', () => {
    const a = st().addObject('builtin:pallet')!;
    const b = st().addObject('builtin:pallet')!;
    const pa = objs().find((x) => x.id === a)!.position;
    const pb = objs().find((x) => x.id === b)!.position;
    expect(pa.x !== pb.x || pa.z !== pb.z).toBe(true);
    expect(objs().find((x) => x.id === b)!.name).toBe('Palette (2)');
  });

  it('rejects unknown assets with an error toast', () => {
    expect(st().addObject('builtin:nope')).toBeUndefined();
    expect(st().toasts.at(-1)?.kind).toBe('error');
  });

  it('transforms, undoes and redoes', () => {
    const id = st().addObject('builtin:cone')!;
    st().setTransforms([{ id, position: { x: 5, y: 0, z: -2 }, rotation: { x: 0, y: 90, z: 0 } }], 'Déplacer');
    expect(objs()[0].position).toEqual({ x: 5, y: 0, z: -2 });
    st().undo();
    expect(objs()[0].position).not.toEqual({ x: 5, y: 0, z: -2 });
    st().redo();
    expect(objs()[0].rotation.y).toBe(90);
    st().undo();
    st().undo();
    expect(objs()).toHaveLength(0);
    expect(st().selection).toEqual([]);
  });

  it('coalesces rapid edits with the same key into one undo step', () => {
    const id = st().addObject('builtin:cone')!;
    for (let i = 1; i <= 5; i++) st().patchObjects([id], () => ({ scale: { x: i, y: i, z: i } }), 'Redimensionner', 'k');
    expect(st().past).toHaveLength(2);
    st().undo();
    expect(objs()[0].scale.x).toBe(1);
  });

  it('duplicates with offset and unlocks the copy; copies to another scene', () => {
    const id = st().addObject('builtin:desk')!;
    st().patchObjects([id], () => ({ locked: true }), 'Verrouiller');
    const [copy] = st().duplicateObjects([id]);
    const c = objs().find((x) => x.id === copy)!;
    expect(c.position.x).toBe(objs().find((x) => x.id === id)!.position.x + 1);
    expect(c.locked).toBe(false);
    const other = st().project!.scenes[1].id;
    const [moved] = st().duplicateObjects([id], other);
    expect(objs().find((x) => x.id === moved)!.sceneId).toBe(other);
    // Same asset, no file duplication.
    expect(objs().find((x) => x.id === moved)!.assetId).toBe('builtin:desk');
  });

  it('removes groups with their children', () => {
    const a = st().addObject('builtin:cone')!;
    const b = st().addObject('builtin:barrier')!;
    const g = st().groupObjects([a, b])!;
    st().removeObjects([g]);
    expect(objs()).toHaveLength(0);
  });

  it('group / ungroup preserves world transforms', () => {
    const a = st().addObject('builtin:cone')!;
    const b = st().addObject('builtin:barrier')!;
    st().setTransforms([{ id: a, position: { x: 2, y: 0, z: 3 }, rotation: { x: 0, y: 45, z: 0 } }], 't');
    const before = decompose(worldMatrix(a, objs())).position;
    const g = st().groupObjects([a, b])!;
    expect(objs().find((x) => x.id === a)!.parentId).toBe(g);
    // Rotate and move the group, then ungroup: world position follows the group.
    st().setTransforms([{ id: g, position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 90, z: 0 } }], 't');
    const inGroup = worldMatrix(a, objs()).elements;
    st().ungroup(g);
    const after = objs().find((x) => x.id === a)!;
    expect(after.parentId).toBeUndefined();
    // Same world matrix (Euler angles may differ but describe the same rotation, 45° + 90°).
    worldMatrix(a, objs()).elements.forEach((v, i) => expect(v).toBeCloseTo(inGroup[i], 3));
    expect(before.x).toBe(2);
    expect(objs().some((o) => o.id === g)).toBe(false);
  });

  it('refuses to reparent a group into its own child', () => {
    const a = st().addObject('builtin:cone')!;
    const b = st().addObject('builtin:barrier')!;
    const g = st().groupObjects([a, b])!;
    const c = st().addObject('builtin:plant')!;
    const g2 = st().groupObjects([c, g])!;
    st().reparent(g2, a);
    expect(objs().find((x) => x.id === g2)!.parentId).toBeUndefined();
  });

  it('aligns and distributes', () => {
    const ids = ['builtin:cone', 'builtin:cone', 'builtin:cone'].map((x) => st().addObject(x)!);
    st().setTransforms(ids.map((id, i) => ({ id, position: { x: [0, 7, 10][i], y: 0, z: i } })), 't');
    st().distribute(ids, 'x');
    expect(objs().map((o) => o.position.x).sort((a, b) => a - b)).toEqual([0, 5, 10]);
    st().align(ids, 'z', 'min');
    expect(objs().every((o) => o.position.z === 0)).toBe(true);
  });
});

describe('library assets', () => {
  const asset = (): Asset3D => ({
    id: 'ast_test',
    projectId: st().project!.id,
    name: 'Modèle',
    category: 'imported',
    source: { kind: 'file', fileId: 'file_x', originalFormat: 'glb' },
    format: 'GLB',
    imported: true,
    size: { x: 1, y: 1, z: 1 },
    createdAt: '',
    updatedAt: '',
  });

  it('soft-deletes an asset with its instances, undoable', () => {
    st().addAsset(asset());
    st().addObject('ast_test');
    st().deleteAsset('ast_test');
    expect(objs()).toHaveLength(0);
    expect(st().project!.assets[0].deletedAt).toBeTruthy();
    expect(st().addObject('ast_test')).toBeUndefined();
    st().undo();
    expect(objs()).toHaveLength(1);
    expect(st().project!.assets[0].deletedAt).toBeUndefined();
  });

  it('never deletes or renames built-in assets', () => {
    st().deleteAsset('builtin:cone');
    st().updateAsset('builtin:cone', { name: 'x' });
    expect(st().past).toHaveLength(0);
  });

  it('toggles favorites', () => {
    st().toggleFavorite('builtin:cone');
    expect(st().project!.favorites).toContain('builtin:cone');
    st().toggleFavorite('builtin:cone');
    expect(st().project!.favorites).not.toContain('builtin:cone');
  });
});

describe('scenes', () => {
  it('keeps objects per scene and deletes them with their scene', () => {
    st().addObject('builtin:cone');
    const second = st().project!.scenes[1].id;
    st().setActiveScene(second);
    st().addObject('builtin:plant');
    expect(objs().filter((o) => o.sceneId === second)).toHaveLength(1);
    st().deleteScene(second);
    expect(objs()).toHaveLength(1);
    expect(st().activeSceneId).not.toBe(second);
  });
});

describe('persistence', () => {
  it('saves and reloads the project', async () => {
    st().addObject('builtin:forklift');
    expect(await st().save({ silent: true })).toBe(true);
    expect(st().dirty).toBe(false);
    const loaded = await loadActiveProject();
    expect(loaded?.objects).toHaveLength(1);
    expect(loaded?.revision).toBe(st().baseRevision);
  });

  it('detects a conflict when another session saved first, then overwrites on request', async () => {
    await st().save({ silent: true });
    const base = st().baseRevision;
    // Simulate another tab: save from a stale base revision.
    const { saveProject } = await import('../src/services/persistence');
    await saveProject({ ...st().project!, name: 'Autre onglet' }, base);
    st().addObject('builtin:cone');
    expect(await st().save({ silent: true })).toBe(false);
    expect(st().saveStatus).toBe('conflict');
    await st().resolveConflict('overwrite');
    expect(st().saveStatus).toBe('saved');
    expect((await loadActiveProject())?.objects).toHaveLength(1);
  });

  it('publishes as a distinct step from saving', async () => {
    st().addObject('builtin:cone');
    await st().publish();
    const p = st().project!;
    expect(p.status).toBe('published');
    expect(p.publishedRevision).toBe(p.revision);
    st().addObject('builtin:cone');
    await st().save({ silent: true });
    expect(st().project!.publishedRevision).toBeLessThan(st().project!.revision);
  });
});
