// Project persistence. The app uses the VISORA API (PostgreSQL + S3 behind it); unit tests
// swap in the IndexedDB backend with setBackend(). The Studio only talks to these functions.
import type { ProjectDoc } from '../types';
import { api, apiRaw, ApiError } from './api';

export class ConflictError extends Error {
  constructor(public remote: ProjectDoc) {
    super('Le projet a été modifié ailleurs (autre onglet, autre session ou autre membre).');
    this.name = 'ConflictError';
  }
}

export type Backend = {
  loadProject(id: string): Promise<ProjectDoc | undefined>;
  loadLastProject(): Promise<ProjectDoc | undefined>;
  /** Saves if the stored revision still equals baseRevision; throws ConflictError otherwise. */
  saveProject(doc: ProjectDoc, baseRevision: number, opts?: { force?: boolean }): Promise<ProjectDoc>;
  /** Publishes the already-saved revision. */
  publishProject(id: string, revision: number): Promise<ProjectDoc>;
  loadPublished(id: string): Promise<ProjectDoc | undefined>;
  /** Stores a file for the project and returns its id. */
  uploadFile(projectId: string, blob: Blob, name: string): Promise<string>;
  getFile(fileId: string): Promise<Blob | undefined>;
  /** URL usable by <img>/<video>/<audio>/<iframe> (no Authorization header possible there). */
  mediaUrl(fileId: string): Promise<string>;
};

const LAST_KEY = 'visora:last-project';
export const rememberLastProject = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* ignore */
  }
};
export const lastProjectId = () => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};

/**
 * In the visitor space, model files are fetched through the public endpoint of the tour
 * (only files referenced by the published snapshot are served there).
 */
let publicTourId: string | null = null;

/** Visitor access tokens for password-protected tours (kept for the browser session only). */
const accessKey = (id: string) => `visora:tour-access:${id}`;
export function tourAccessToken(id: string): string | null {
  try {
    return sessionStorage.getItem(accessKey(id));
  } catch {
    return null;
  }
}
export const tourAccessHeaders = (id: string): Record<string, string> => {
  const t = accessFor(id);
  return t ? { 'x-tour-access': t } : {};
};

export class TourLockedError extends Error {
  constructor(public tourName?: string) {
    super('Cette visite est protégée par un mot de passe.');
    this.name = 'TourLockedError';
  }
}
export class TourExpiredError extends Error {
  constructor() {
    super('Ce lien de visite a expiré.');
    this.name = 'TourExpiredError';
  }
}

/** Exchanges the password for an access token; throws ApiError(wrong_password) when refused. */
export async function unlockTour(id: string, password: string) {
  const r = await api<{ token: string }>(`/api/public/tours/${encodeURIComponent(id)}/access`, { body: { password }, auth: false });
  try {
    sessionStorage.setItem(accessKey(id), r.token);
  } catch {
    /* private mode: token kept only for this page */
  }
  memoryTokens.set(id, r.token);
}
const memoryTokens = new Map<string, string>();
const accessFor = (id: string) => tourAccessToken(id) ?? memoryTokens.get(id) ?? null;
export const setPublicTourContext = (projectId: string | null) => {
  publicTourId = projectId;
};

const meta = (doc: ProjectDoc) => ({
  name: doc.name,
  type: doc.type ?? 'other',
  description: doc.description ?? null,
  document: {
    scenes: doc.scenes,
    objects: doc.objects,
    assets: doc.assets,
    favorites: doc.favorites,
    settings: doc.settings,
    hotspots: doc.hotspots ?? [],
    navigation: doc.navigation ?? [],
    floorPlans: doc.floorPlans ?? [],
    guidedTours: doc.guidedTours ?? [],
    annotations: doc.annotations ?? [],
  },
});

const signed = new Map<string, { url: string; until: number }>();

export const apiBackend: Backend = {
  async mediaUrl(fileId) {
    if (publicTourId) {
      const t = accessFor(publicTourId);
      return `/api/public/tours/${publicTourId}/files/${fileId}${t ? `?access=${encodeURIComponent(t)}` : ''}`;
    }
    const hit = signed.get(fileId);
    if (hit && hit.until > Date.now()) return hit.url;
    const r = await api<{ url: string; expiresAt: string }>(`/api/files/${fileId}/url`);
    // Renew a minute before expiry.
    signed.set(fileId, { url: r.url, until: new Date(r.expiresAt).getTime() - 60_000 });
    return r.url;
  },
  async loadProject(id) {
    try {
      return await api<ProjectDoc>(`/api/projects/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return undefined;
      throw e;
    }
  },
  async loadLastProject() {
    const id = lastProjectId();
    return id ? this.loadProject(id) : undefined;
  },
  async saveProject(doc, baseRevision, opts = {}) {
    try {
      return await api<ProjectDoc>(`/api/projects/${doc.id}`, { method: 'PUT', body: { ...meta(doc), baseRevision, force: opts.force } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revision_conflict') throw new ConflictError(e.body?.current as ProjectDoc);
      throw e;
    }
  },
  async publishProject(id, revision) {
    try {
      return await api<ProjectDoc>(`/api/projects/${id}/publish`, { body: { revision } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revision_conflict') throw new ConflictError(e.body?.current as ProjectDoc);
      throw e;
    }
  },
  async loadPublished(id) {
    try {
      const t = accessFor(id);
      return await api<ProjectDoc>(`/api/public/tours/${encodeURIComponent(id)}`, { auth: false, headers: t ? { 'x-tour-access': t } : {} });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'password_required') throw new TourLockedError(e.body?.name as string | undefined);
      if (e instanceof ApiError && e.code === 'tour_expired') throw new TourExpiredError();
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return undefined;
      throw e;
    }
  },
  async uploadFile(projectId, blob, name) {
    const form = new FormData();
    form.append('file', blob, name);
    const r = await api<{ id: string }>(`/api/projects/${projectId}/files`, { form });
    return r.id;
  },
  async getFile(fileId) {
    const path = publicTourId ? `/api/public/tours/${publicTourId}/files/${fileId}` : `/api/files/${fileId}/content`;
    try {
      const t = publicTourId ? accessFor(publicTourId) : null;
      return await (await apiRaw(path, { auth: !publicTourId, headers: t ? { 'x-tour-access': t } : {} })).blob();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  },
};

let backend: Backend = apiBackend;
export const setBackend = (b: Backend) => {
  backend = b;
};

export const loadProject = (id: string) => backend.loadProject(id);
export const loadActiveProject = () => backend.loadLastProject();
export const loadPublished = (id: string) => backend.loadPublished(id);
export const uploadFile = (projectId: string, blob: Blob, name: string) => backend.uploadFile(projectId, blob, name);
export const getFile = (fileId: string) => backend.getFile(fileId);
export const mediaUrl = (fileId: string) => backend.mediaUrl(fileId);

export async function saveProject(doc: ProjectDoc, baseRevision: number, opts: { force?: boolean } = {}) {
  const saved = await backend.saveProject(doc, baseRevision, opts);
  rememberLastProject(saved.id);
  notifyOtherTabs(saved.id, saved.revision);
  return saved;
}

export const publishProject = (id: string, revision: number) => backend.publishProject(id, revision);

let channel: BroadcastChannel | undefined;
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  return (channel ??= new BroadcastChannel('visora-studio'));
}
function notifyOtherTabs(projectId: string, revision: number) {
  getChannel()?.postMessage({ type: 'saved', projectId, revision });
}
export function onRemoteSave(cb: (projectId: string, revision: number) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'saved') cb(e.data.projectId, e.data.revision);
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
