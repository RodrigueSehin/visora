// Demonstration dataset shown ONLY when demo mode is switched on (badge + banner).
// It reproduces the reference mockup and is never saved or mixed with real data.
import type { ProjectType } from '../types';

export type DashboardTour = {
  id: string;
  name: string;
  type: ProjectType;
  status: 'published' | 'outdated' | 'processing' | 'draft';
  visitors: number | null;
  demo?: boolean;
};

export type AiJob = { id: string; name: string; step: string; progress: number; type: ProjectType };

export const DEMO = {
  profile: { name: 'Sehin Rodrigue', organization: 'SEHIN GROUP' },
  kpis: {
    created: 12,
    createdThisMonth: 3,
    published: 9,
    publishedThisMonth: 2,
    aiRunning: 2,
    visitors: 842,
    visitorsTrend: 24,
    avgDurationMs: (6 * 60 + 28) * 1000,
    durationTrend: 18,
  },
  tours: [
    { id: 'demo-1', name: 'Entrepôt Logistique – Abidjan', type: 'logistics', status: 'published', visitors: 284 },
    { id: 'demo-2', name: 'Villa Riviera – Cocody', type: 'real-estate', status: 'published', visitors: 196 },
    { id: 'demo-3', name: 'Laboratoire de recherche', type: 'laboratory', status: 'processing', visitors: null },
    { id: 'demo-4', name: 'Usine de production', type: 'industry', status: 'draft', visitors: null },
  ] as DashboardTour[],
  aiJobs: [
    { id: 'job-1', name: 'Entrepôt – Zone Nord', step: 'Reconstruction 3D (1 245 images)', progress: 72, type: 'logistics' },
    { id: 'job-2', name: 'Laboratoire – Bloc A', step: 'Analyse des espaces (632 images)', progress: 38, type: 'laboratory' },
  ] as AiJob[],
  breakdown: [
    { type: 'real-estate', count: 5 },
    { type: 'logistics', count: 3 },
    { type: 'laboratory', count: 2 },
    { type: 'industry', count: 1 },
    { type: 'other', count: 1 },
  ] as { type: ProjectType; count: number }[],
  // Daily views over 30 days (ends on today), shaped like the mockup curve.
  views30: [55, 62, 70, 80, 88, 78, 70, 98, 120, 140, 128, 110, 98, 104, 125, 150, 165, 168, 160, 150, 142, 150, 168, 180, 182, 176, 190, 204, 222, 238],
  storage: { used: 128.6 * 1024 ** 3, quota: 500 * 1024 ** 3 },
  plan: { name: 'Plan Pro', renewal: '30 déc. 2026' },
};
