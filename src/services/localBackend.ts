// IndexedDB implementation of the project backend. Used by the unit tests (and usable as an
// offline adapter); the application itself talks to the VISORA API (see persistence.ts).
import { createStore, del, entries, get, set, update, type UseStore } from 'idb-keyval';
import { uid } from '../lib/ids';
import type { ProjectDoc } from '../types';
import { ConflictError, type Backend } from './persistence';

let store: UseStore | undefined;
const db = () => (store ??= createStore('visora-studio', 'kv'));

const PROJECT_KEY = (id: string) => `project:${id}`;
const PUBLISHED_KEY = (id: string) => `published:${id}`;
const FILE_KEY = (id: string) => `file:${id}`;
const ACTIVE_KEY = 'active-project';

export const localBackend: Backend = {
  async loadProject(id) {
    return get<ProjectDoc>(PROJECT_KEY(id), db());
  },

  async loadLastProject() {
    const id = await get<string>(ACTIVE_KEY, db());
    return id ? get<ProjectDoc>(PROJECT_KEY(id), db()) : undefined;
  },

  async saveProject(doc, baseRevision, opts = {}) {
    const current = await get<ProjectDoc>(PROJECT_KEY(doc.id), db());
    if (current && current.revision !== baseRevision && !opts.force) throw new ConflictError(current);
    const next: ProjectDoc = { ...doc, revision: Math.max(current?.revision ?? 0, baseRevision) + 1, updatedAt: new Date().toISOString() };
    await set(PROJECT_KEY(doc.id), structuredClone(next), db());
    await set(ACTIVE_KEY, doc.id, db());
    return next;
  },

  async publishProject(id, revision) {
    const current = await get<ProjectDoc>(PROJECT_KEY(id), db());
    if (!current) throw new Error('Projet introuvable');
    if (current.revision !== revision) throw new ConflictError(current);
    const published: ProjectDoc = { ...current, status: 'published', publishedRevision: revision, publishedAt: new Date().toISOString() };
    await set(PROJECT_KEY(id), structuredClone(published), db());
    await set(PUBLISHED_KEY(id), structuredClone(published), db());
    return published;
  },

  async loadPublished(id) {
    return get<ProjectDoc>(PUBLISHED_KEY(id), db());
  },

  async uploadFile(_projectId, blob) {
    const id = uid('file');
    await set(FILE_KEY(id), blob, db());
    return id;
  },

  async getFile(fileId) {
    return get<Blob>(FILE_KEY(fileId), db());
  },

  async mediaUrl(fileId) {
    const blob = await get<Blob>(FILE_KEY(fileId), db());
    if (!blob) throw new Error('Fichier introuvable');
    return URL.createObjectURL(blob);
  },
};

// ---- Local-only helpers kept for tests ----

export async function listLocalProjects(): Promise<ProjectDoc[]> {
  const all = await entries<string, unknown>(db());
  return all
    .filter(([k]) => typeof k === 'string' && k.startsWith('project:'))
    .map(([, v]) => v as ProjectDoc)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteLocalProject(id: string): Promise<void> {
  const p = await get<ProjectDoc>(PROJECT_KEY(id), db());
  for (const a of p?.assets ?? []) if (a.source.kind === 'file') await del(FILE_KEY(a.source.fileId), db());
  await del(PROJECT_KEY(id), db());
  await del(PUBLISHED_KEY(id), db());
}

export type { VisitSession } from './analytics';
import type { VisitSession } from './analytics';
const SESSIONS_KEY = 'analytics:sessions';

export async function loadLocalSessions(): Promise<VisitSession[]> {
  return (await get<VisitSession[]>(SESSIONS_KEY, db())) ?? [];
}

export async function upsertLocalSession(s: VisitSession): Promise<void> {
  await update<VisitSession[]>(SESSIONS_KEY, (list = []) => {
    const i = list.findIndex((x) => x.id === s.id);
    return i >= 0 ? list.map((x, j) => (j === i ? s : x)) : [...list, s];
  }, db());
}
