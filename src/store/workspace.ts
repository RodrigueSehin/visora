// Creator-space state: projects and statistics of the active organization (from the API),
// plus the explicit, labelled demo mode.
import { create } from 'zustand';
import { createProject as buildProject } from '../lib/defaultProject';
import { api } from '../services/api';
import type { ProjectDoc, ProjectType } from '../types';
import { useSession } from './session';

export type ProjectSummary = {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  revision: number;
  status: 'draft' | 'published';
  publishedRevision?: number;
  publishedAt?: string;
  visibility?: 'unlisted' | 'public';
  sceneCount: number;
  objectCount: number;
  storageBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type OrgStats = {
  days: number;
  projects: { created: number; createdThisMonth: number; published: number; publishedThisMonth: number };
  audience: { views: number; visitors: number; avgDurationMs: number; visitorsTrend: number | null; durationTrend: number | null };
  series: { date: string; views: number }[];
  perProject: { projectId: string; views: number; visitors: number; avgDurationMs: number }[];
  visitorsAllTime: Record<string, number>;
  breakdown: { type: ProjectType; count: number }[];
  storage: { usedBytes: number; quotaBytes: number | null };
  ai: { running: number; available: boolean };
};

const DEMO_KEY = 'visora:demo';
const readDemo = () => {
  try {
    return localStorage.getItem(DEMO_KEY) === 'true';
  } catch {
    return false;
  }
};

type WorkspaceState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  projects: ProjectSummary[];
  stats: OrgStats | null;
  statsDays: number;
  demo: boolean;
  refresh: (days?: number) => Promise<void>;
  createProject: (opts: { name: string; type: ProjectType; description?: string }) => Promise<ProjectDoc>;
  deleteProject: (id: string) => Promise<void>;
  setVisibility: (id: string, visibility: 'unlisted' | 'public') => Promise<void>;
  unpublish: (id: string) => Promise<void>;
  setDemo: (v: boolean) => void;
};

const orgId = () => {
  const id = useSession.getState().orgId;
  if (!id) throw new Error('Aucune organisation active.');
  return id;
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  status: 'idle',
  projects: [],
  stats: null,
  statsDays: 30,
  demo: readDemo(),

  async refresh(days = get().statsDays) {
    if (get().status !== 'ready') set({ status: 'loading' });
    try {
      const org = orgId();
      const [projects, stats] = await Promise.all([
        api<ProjectSummary[]>(`/api/orgs/${org}/projects`),
        api<OrgStats>(`/api/orgs/${org}/stats?days=${days}`),
      ]);
      set({ projects, stats, statsDays: days, status: 'ready', error: undefined });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async createProject(opts) {
    // Starter scenes adapted to the type are generated client-side, then stored by the API.
    const draft = buildProject(opts);
    const doc = await api<ProjectDoc>(`/api/orgs/${orgId()}/projects`, {
      body: {
        name: draft.name,
        type: draft.type,
        description: draft.description ?? null,
        document: { scenes: draft.scenes, objects: [], assets: [], favorites: [], settings: draft.settings },
      },
    });
    void get().refresh();
    return doc;
  },

  async deleteProject(id) {
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    await get().refresh();
  },

  async setVisibility(id, visibility) {
    await api(`/api/projects/${id}/publication`, { method: 'PATCH', body: { visibility } });
    await get().refresh();
  },

  async unpublish(id) {
    await api(`/api/projects/${id}/unpublish`, { method: 'POST' });
    await get().refresh();
  },

  setDemo(v) {
    try {
      localStorage.setItem(DEMO_KEY, String(v));
    } catch {
      /* session-only */
    }
    set({ demo: v });
  },
}));

export type TourStatus = 'published' | 'outdated' | 'processing' | 'draft';

/** Published = a published snapshot exists; "outdated" = edited since publication. */
export function tourStatus(p: { status: string; revision: number; publishedRevision?: number }): TourStatus {
  if (p.status !== 'published') return 'draft';
  return p.publishedRevision === p.revision ? 'published' : 'outdated';
}
