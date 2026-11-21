// Media library of the open project (server state, not part of the undoable document).
import { create } from 'zustand';
import { api, ApiError, getAccessToken, refreshSession } from '../../services/api';
import { useEditor } from '../../store/editor';

export type MediaKind = 'model' | 'image' | 'panorama' | 'texture' | 'video' | 'document' | 'audio';
export type Media = {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  folder?: string;
  favorite: boolean;
  createdAt: string;
  deletedAt?: string;
};

export type Upload = { key: string; name: string; progress: number; status: 'uploading' | 'done' | 'error'; error?: string };

export const ACCEPT_MEDIA = '.jpg,.jpeg,.png,.webp,.mp4,.m4v,.mov,.webm,.pdf,.mp3,.wav,.glb';
export const MAX_UPLOAD_MB = 100;

export const KIND_LABEL: Record<MediaKind, string> = {
  image: 'Image',
  panorama: 'Panorama 360°',
  texture: 'Texture',
  video: 'Vidéo',
  document: 'Document (PDF)',
  audio: 'Audio',
  model: 'Modèle 3D',
};

type MediaState = {
  projectId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  items: Media[];
  trash: Media[];
  uploads: Upload[];
  load: (force?: boolean) => Promise<void>;
  upload: (files: File[], folder?: string) => Promise<Media[]>;
  update: (id: string, patch: Partial<Pick<Media, 'name' | 'folder' | 'favorite' | 'kind'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  destroy: (id: string) => Promise<void>;
};

const projectId = () => useEditor.getState().project?.id ?? null;
const toast = (kind: 'success' | 'error' | 'info' | 'warning', text: string) => useEditor.getState().toast({ kind, text });

/** Upload with progress (XHR); retries once after refreshing an expired access token. */
function xhrUpload(url: string, file: File, onProgress: (p: number) => void, retry = true): Promise<Media> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, 'network_error', 'Connexion au serveur impossible.'));
    xhr.onload = async () => {
      if (xhr.status === 401 && retry && (await refreshSession())) return xhrUpload(url, file, onProgress, false).then(resolve, reject);
      let body: { error?: { code: string; message: string } } & Partial<Media> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as Media);
      else
        reject(
          new ApiError(
            xhr.status,
            body.error?.code ?? 'http_error',
            xhr.status === 413 ? `Fichier trop volumineux (limite ${MAX_UPLOAD_MB} Mo).` : body.error?.message ?? `Erreur ${xhr.status}`,
          ),
        );
    };
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}

export const useMedia = create<MediaState>((set, get) => ({
  projectId: null,
  status: 'idle',
  items: [],
  trash: [],
  uploads: [],

  async load(force) {
    const pid = projectId();
    if (!pid) return;
    if (!force && get().projectId === pid && get().status === 'ready') return;
    set({ status: get().projectId === pid ? get().status : 'loading', projectId: pid });
    const known = new Set(get().items.map((m) => m.id));
    try {
      const [fetched, trash] = await Promise.all([api<Media[]>(`/api/projects/${pid}/files`), api<Media[]>(`/api/projects/${pid}/files?trash=1`)]);
      // Files uploaded while the list was loading are not in the (older) response: keep them.
      const added = get().items.filter((m) => !known.has(m.id) && !fetched.some((f) => f.id === m.id));
      set({ items: [...added, ...fetched], trash, status: 'ready', error: undefined });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async upload(files, folder) {
    const pid = projectId();
    if (!pid) return [];
    const done: Media[] = [];
    await Promise.all(
      files.map(async (file) => {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        set({ uploads: [...get().uploads, { key, name: file.name, progress: 0, status: 'uploading' }] });
        const patch = (p: Partial<Upload>) => set({ uploads: get().uploads.map((u) => (u.key === key ? { ...u, ...p } : u)) });
        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return patch({ status: 'error', error: `Trop volumineux (> ${MAX_UPLOAD_MB} Mo)` });
        try {
          const m = await xhrUpload(`/api/projects/${pid}/files${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`, file, (progress) => patch({ progress }));
          done.push(m);
          patch({ status: 'done', progress: 1 });
          set({ items: [m, ...get().items] });
        } catch (e) {
          patch({ status: 'error', error: e instanceof Error ? e.message : String(e) });
        }
      }),
    );
    const failed = get().uploads.filter((u) => u.status === 'error').length;
    if (done.length) toast('success', `${done.length} média${done.length > 1 ? 's' : ''} importé${done.length > 1 ? 's' : ''}.`);
    if (failed) toast('error', `${failed} fichier${failed > 1 ? 's' : ''} refusé${failed > 1 ? 's' : ''} : voir le détail dans la liste d’import.`);
    // Finished uploads disappear after a moment; failures stay until dismissed by a new import.
    setTimeout(() => set({ uploads: get().uploads.filter((u) => u.status !== 'done') }), 2500);
    return done;
  },

  async update(id, patch) {
    try {
      const m = await api<Media>(`/api/files/${id}`, { method: 'PATCH', body: patch });
      set({ items: get().items.map((x) => (x.id === id ? m : x)) });
    } catch (e) {
      toast('error', e instanceof Error ? e.message : String(e));
      throw e;
    }
  },

  async remove(id) {
    await api(`/api/files/${id}`, { method: 'DELETE' });
    const m = get().items.find((x) => x.id === id);
    set({ items: get().items.filter((x) => x.id !== id), trash: m ? [{ ...m, deletedAt: new Date().toISOString() }, ...get().trash] : get().trash });
  },

  async restore(id) {
    const m = await api<Media>(`/api/files/${id}/restore`, { method: 'POST' });
    set({ trash: get().trash.filter((x) => x.id !== id), items: [m, ...get().items] });
  },

  async destroy(id) {
    await api(`/api/files/${id}/permanent`, { method: 'DELETE' });
    set({ trash: get().trash.filter((x) => x.id !== id) });
  },
}));

/** Where a media file is used in the current document (scenes, hotspots, 3D assets). */
export function mediaUsage(id: string): string[] {
  const p = useEditor.getState().project;
  if (!p) return [];
  const out: string[] = [];
  for (const s of p.scenes) if (s.panoramaFileId === id) out.push(`Scène 360° « ${s.name} »`);
  for (const s of p.scenes) if (s.thumbnailFileId === id) out.push(`Vignette de la scène « ${s.name} »`);
  for (const h of p.hotspots ?? []) if (h.mediaId === id) out.push(`Hotspot « ${h.title} »`);
  for (const a of p.assets) if (!a.deletedAt && a.source.kind === 'file' && a.source.fileId === id) out.push(`Objet 3D « ${a.name} »`);
  return out;
}
