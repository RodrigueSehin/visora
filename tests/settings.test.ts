import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import { addAnnotation, deleteSceneDeep, removeAnnotation, updateAnnotation, updateAppearance } from '../src/store/tourActions';
import { controlOn } from '../src/studio/settings/AppearanceModule';

setBackend(localBackend);
const st = () => useEditor.getState();
const p = () => st().project!;

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('annotations', () => {
  it('are studio-only by default, editable, undoable and removed with their scene', () => {
    const scene = st().activeSceneId;
    const id = addAnnotation()!;
    expect(p().annotations![0]).toMatchObject({ sceneId: scene, visibility: 'studio' });
    updateAnnotation(id, { text: 'Vérifier l’extincteur', visibility: 'public' });
    expect(p().annotations![0].visibility).toBe('public');
    removeAnnotation(id);
    expect(p().annotations).toHaveLength(0);
    st().undo();
    expect(p().annotations![0].text).toBe('Vérifier l’extincteur');
    deleteSceneDeep(scene);
    expect(p().annotations).toHaveLength(0);
  });
});

describe('appearance', () => {
  it('merges settings, shows every control by default and persists', async () => {
    expect(controlOn(undefined, 'plan')).toBe(true);
    updateAppearance({ accent: '#ff6600' });
    updateAppearance({ controls: { plan: false }, welcome: { enabled: true, title: 'Bienvenue' } });
    const a = p().settings.appearance!;
    expect(a.accent).toBe('#ff6600');
    expect(controlOn(a, 'plan')).toBe(false);
    expect(controlOn(a, 'share')).toBe(true);
    expect(await st().save({ silent: true })).toBe(true);
    expect((await localBackend.loadProject(p().id))?.settings.appearance?.welcome?.title).toBe('Bienvenue');
    st().undo();
    expect(p().settings.appearance?.welcome).toBeUndefined();
  });
});
