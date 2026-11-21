// Visit quality score: real checks on the project document, each with a weight and a module to fix it.
import type { StudioModule } from '../../store/editor';
import { brokenSteps } from '../../store/planActions';
import { homeSceneId, unreachableScenes } from '../../store/tourActions';
import type { ProjectDoc } from '../../types';
import { hotspotProblem } from './HotspotsModule';

export type QualityCheck = {
  id: string;
  label: string;
  /** Human-readable detail of what is missing (absent when the check passes). */
  issue?: string;
  ok: boolean;
  weight: number;
  module: StudioModule;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function tourQuality(p: ProjectDoc): { score: number; checks: QualityCheck[] } {
  const visible = p.scenes.filter((s) => !s.hidden);
  const hotspots = p.hotspots ?? [];
  const nav = p.navigation ?? [];
  const checks: QualityCheck[] = [];
  const add = (c: Omit<QualityCheck, 'ok'>) => checks.push({ ...c, ok: !c.issue });

  const home = homeSceneId(p);
  add({ id: 'home', label: 'Scène d’accueil visible', weight: 2, module: 'scenes', issue: !home || p.scenes.find((s) => s.id === home)?.hidden ? 'La scène d’accueil est masquée.' : undefined });

  const isolated = unreachableScenes(p).filter((id) => visible.some((s) => s.id === id));
  add({ id: 'reach', label: 'Toutes les scènes sont accessibles', weight: 3, module: 'navigation', issue: isolated.length ? `${plural(isolated.length, 'scène')} inaccessible(s) depuis l’accueil.` : undefined });

  const noPano = p.scenes.filter((s) => s.kind === 'panorama' && !s.panoramaFileId);
  add({ id: 'pano', label: 'Images 360° renseignées', weight: 3, module: 'scenes', issue: noPano.length ? `${plural(noPano.length, 'scène')} 360° sans image.` : undefined });

  const noThumb = visible.filter((s) => !s.thumbnailFileId && !(s.kind === 'panorama' && s.panoramaFileId));
  add({ id: 'thumb', label: 'Vignettes des scènes', weight: 1, module: 'scenes', issue: noThumb.length ? `${plural(noThumb.length, 'scène')} sans vignette.` : undefined });

  const noDesc = visible.filter((s) => !s.description?.trim());
  add({ id: 'desc', label: 'Descriptions des scènes', weight: 1, module: 'scenes', issue: noDesc.length ? `${plural(noDesc.length, 'scène')} sans description.` : undefined });

  const badHs = hotspots.filter((h) => hotspotProblem(h));
  add({ id: 'hotspots', label: 'Hotspots complets', weight: 2, module: 'hotspots', issue: badHs.length ? `${plural(badHs.length, 'hotspot')} incomplet(s).` : undefined });

  const brokenNav = nav.filter((n) => !p.scenes.some((s) => s.id === n.targetSceneId));
  add({ id: 'nav', label: 'Points de navigation valides', weight: 2, module: 'navigation', issue: brokenNav.length ? `${plural(brokenNav.length, 'point')} vers une scène supprimée.` : undefined });

  const broken = (p.guidedTours ?? []).reduce((n, t) => n + brokenSteps(t, p.scenes).length, 0);
  add({ id: 'tours', label: 'Parcours guidés sans étape cassée', weight: 1, module: 'tour', issue: broken ? `${plural(broken, 'étape')} vers une scène absente ou masquée.` : undefined });

  const total = checks.reduce((a, c) => a + c.weight, 0);
  const score = Math.round((checks.reduce((a, c) => a + (c.ok ? c.weight : 0), 0) / total) * 100);
  return { score, checks };
}

/** Navigation-only score shown by the Navigation module. */
export function navigationQuality(p: ProjectDoc): { score: number; checks: QualityCheck[] } {
  const all = tourQuality(p).checks;
  const pick = (id: string) => all.find((c) => c.id === id)!;
  const visible = p.scenes.filter((s) => !s.hidden);
  const nav = p.navigation ?? [];
  const deadEnds = visible.length > 1 ? visible.filter((s) => !nav.some((n) => n.sceneId === s.id && visible.some((v) => v.id === n.targetSceneId))) : [];
  const exits: QualityCheck = {
    id: 'exits',
    label: 'Chaque scène a une sortie',
    weight: 2,
    module: 'navigation',
    issue: deadEnds.length ? `${plural(deadEnds.length, 'scène')} sans point de navigation vers une autre scène (impasse).` : undefined,
    ok: !deadEnds.length,
  };
  const checks = [pick('home'), pick('reach'), pick('nav'), exits, pick('tours')];
  const total = checks.reduce((a, c) => a + c.weight, 0);
  return { score: Math.round((checks.reduce((a, c) => a + (c.ok ? c.weight : 0), 0) / total) * 100), checks };
}

/** Floor-plan score shown by the Plan 2D module. */
export function planQuality(p: ProjectDoc): { score: number; checks: QualityCheck[] } {
  const plans = p.floorPlans ?? [];
  const visible = p.scenes.filter((s) => !s.hidden);
  const placed = new Set(plans.flatMap((f) => f.markers.map((m) => m.sceneId)));
  const make = (c: Omit<QualityCheck, 'ok' | 'module'>): QualityCheck => ({ ...c, module: 'plan', ok: !c.issue });
  const noImage = plans.filter((f) => !f.imageFileId);
  const unplaced = visible.filter((s) => !placed.has(s.id));
  const uncalibrated = plans.filter((f) => f.imageFileId && !f.calibration);
  const orphan = plans.reduce((n, f) => n + f.markers.filter((m) => !p.scenes.some((s) => s.id === m.sceneId)).length, 0);
  const checks = [
    make({ id: 'plan-exists', label: 'Au moins un plan', weight: 3, issue: plans.length ? undefined : 'Aucun plan : importez le plan du site.' }),
    make({ id: 'plan-image', label: 'Chaque plan a son image', weight: 2, issue: noImage.length ? `${plural(noImage.length, 'plan')} sans image.` : undefined }),
    make({ id: 'plan-placed', label: 'Toutes les scènes sont placées', weight: 3, issue: unplaced.length ? `${plural(unplaced.length, 'scène')} non placée(s) sur un plan.` : undefined }),
    make({ id: 'plan-calibrated', label: 'Plans calibrés (mesures)', weight: 1, issue: uncalibrated.length ? `${plural(uncalibrated.length, 'plan')} non calibré(s) : les mesures sont indisponibles.` : undefined }),
    make({ id: 'plan-orphans', label: 'Aucun repère orphelin', weight: 1, issue: orphan ? `${plural(orphan, 'repère')} vers une scène supprimée.` : undefined }),
  ];
  const total = checks.reduce((a, c) => a + c.weight, 0);
  return { score: Math.round((checks.reduce((a, c) => a + (c.ok ? c.weight : 0), 0) / total) * 100), checks };
}
