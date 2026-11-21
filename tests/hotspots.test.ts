import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { formMailto } from '../src/components/viewport/TourLayers';
import { createStarterProject } from '../src/lib/defaultProject';
import { localBackend } from '../src/services/localBackend';
import { setBackend } from '../src/services/persistence';
import { useEditor } from '../src/store/editor';
import { addHotspot, updateHotspot } from '../src/store/tourActions';
import { hotspotProblem } from '../src/studio/tour/HotspotsModule';

setBackend(localBackend);
const st = () => useEditor.getState();
const hs = (id: string) => st().project!.hotspots!.find((h) => h.id === id)!;

beforeEach(async () => {
  useEditor.setState({ toasts: [], selection: [], past: [], future: [] });
  await st().init(createStarterProject());
});

describe('form hotspots', () => {
  it('start with default fields, need a valid recipient and build an encoded mailto', () => {
    const id = addHotspot('form')!;
    expect(hs(id).form?.fields).toEqual(['name', 'email', 'message']);
    expect(hotspotProblem(hs(id))).toMatch(/réception/);
    updateHotspot(id, { form: { ...hs(id).form!, recipient: 'pas-une-adresse' } });
    expect(hotspotProblem(hs(id))).toMatch(/réception/);
    expect(formMailto(hs(id), {})).toBeNull();
    updateHotspot(id, { title: 'Demande de devis', form: { ...hs(id).form!, recipient: 'devis@exemple.com' } });
    expect(hotspotProblem(hs(id))).toBeNull();
    const href = formMailto(hs(id), { name: 'Awa Koné', email: 'awa@exemple.ci', message: 'Bonjour & merci' })!;
    expect(href.startsWith('mailto:devis%40exemple.com?subject=Demande%20de%20devis&body=')).toBe(true);
    expect(decodeURIComponent(href.split('body=')[1])).toBe('Nom : Awa Koné\nE-mail : awa@exemple.ci\nMessage : Bonjour & merci');
  });
});

describe('equipment hotspots', () => {
  it('keep their specs and reject an unsafe "En savoir plus" link', () => {
    const id = addHotspot('equipment')!;
    updateHotspot(id, { specs: [{ label: 'Capacité', value: '1 200 palettes' }] });
    expect(hotspotProblem(hs(id))).toBeNull();
    updateHotspot(id, { moreUrl: 'javascript:alert(1)' });
    expect(hotspotProblem(hs(id))).toMatch(/En savoir plus/);
    updateHotspot(id, { moreUrl: 'https://exemple.com/rack' });
    expect(hotspotProblem(hs(id))).toBeNull();
    st().undo();
    expect(hs(id).moreUrl).toBe('javascript:alert(1)');
  });
});
