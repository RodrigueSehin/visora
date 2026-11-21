import type { EnvironmentPreset, ProjectDoc, ProjectType, Scene } from '../types';
import { nowIso, uid } from './ids';

export const PROJECT_TYPES: { id: ProjectType; label: string; color: string }[] = [
  // Order validated for colour-vision deficiency (dataviz validator, light surface).
  { id: 'real-estate', label: 'Immobilier', color: '#2563EB' },
  { id: 'logistics', label: 'Logistique', color: '#F59E0B' },
  { id: 'laboratory', label: 'Laboratoire', color: '#8B5CF6' },
  { id: 'industry', label: 'Industrie', color: '#0EA5B7' },
  { id: 'other', label: 'Autres', color: '#94A3B8' },
];

export const projectTypeLabel = (t?: ProjectType) => PROJECT_TYPES.find((x) => x.id === (t ?? 'other'))!.label;

const SCENES_BY_TYPE: Record<ProjectType, [string, EnvironmentPreset, number, number, number][]> = {
  logistics: [
    ['Entrée principale', 'warehouse', 30, 24, 9],
    ['Zone de stockage', 'warehouse', 40, 30, 10],
    ['Bureau administratif', 'office', 16, 12, 3.2],
  ],
  industry: [
    ['Atelier de production', 'warehouse', 40, 30, 10],
    ['Salle de contrôle', 'office', 14, 10, 3.2],
  ],
  laboratory: [
    ['Laboratoire principal', 'office', 18, 12, 3.4],
    ['Salle technique', 'office', 12, 10, 3.2],
  ],
  'real-estate': [
    ['Séjour', 'showroom', 10, 8, 3],
    ['Cuisine', 'showroom', 6, 5, 3],
  ],
  other: [['Scène 1', 'showroom', 20, 16, 5]],
};

export function createProject(opts: { name: string; type: ProjectType; description?: string }): ProjectDoc {
  const t = nowIso();
  return {
    id: uid('prj'),
    name: opts.name.trim() || 'Nouvelle visite',
    type: opts.type,
    description: opts.description,
    revision: 0,
    status: 'draft',
    scenes: SCENES_BY_TYPE[opts.type].map(([name, environment, width, depth, height], order): Scene => ({
      id: uid('scn'),
      name,
      environment,
      size: { width, depth, height },
      order,
    })),
    assets: [],
    objects: [],
    favorites: [],
    settings: { autosaveSeconds: 0 },
    createdAt: t,
    updatedAt: t,
  };
}

/** Starter project kept for tests and first launch of the Studio without a project. */
export function createStarterProject(): ProjectDoc {
  const p = createProject({ name: 'Nouveau projet', type: 'logistics' });
  p.scenes.push({ id: uid('scn'), name: 'Showroom', environment: 'showroom', size: { width: 20, depth: 16, height: 5 }, order: 3 });
  return p;
}
