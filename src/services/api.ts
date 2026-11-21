// HTTP client for the VISORA API. The access token lives in memory only; the refresh token
// is an httpOnly cookie scoped to /api/auth that JavaScript can never read.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<(authenticated: boolean) => void>();

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
/** For XMLHttpRequest uploads (progress events), which cannot go through fetch. */
export const getAccessToken = () => accessToken;
export const onAuthChange = (cb: (authenticated: boolean) => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** One refresh at a time, shared by concurrent requests that hit a 401. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) {
        accessToken = null;
        return false;
      }
      accessToken = ((await r.json()) as { accessToken: string }).accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function toError(r: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: { path: string; message: string }[] } & Record<string, unknown> } = {};
  try {
    body = await r.json();
  } catch {
    /* non-JSON error */
  }
  const e = body.error ?? {};
  const fallback = r.status >= 500 ? 'Le serveur est indisponible, réessayez dans un instant.' : `Erreur ${r.status}`;
  return new ApiError(r.status, e.code ?? 'http_error', e.message ?? fallback, e.details, e);
}

type Options = { method?: string; body?: unknown; form?: FormData; auth?: boolean; signal?: AbortSignal; headers?: Record<string, string> };

export async function apiRaw(path: string, opts: Options = {}): Promise<Response> {
  const doFetch = () => {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: 'same-origin',
      signal: opts.signal,
    });
  };
  let r: Response;
  try {
    r = await doFetch();
  } catch {
    throw new ApiError(0, 'network_error', 'Connexion au serveur impossible. Vérifiez votre réseau.');
  }
  if (r.status === 401 && opts.auth !== false) {
    if (await refreshSession()) r = await doFetch();
    else listeners.forEach((l) => l(false));
  }
  if (!r.ok) throw await toError(r);
  return r;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const r = await apiRaw(path, opts);
  return (r.status === 204 ? undefined : await r.json()) as T;
}
