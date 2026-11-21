// Minimal hash router: #/ (creator), #/studio/:id, #/explorer and #/visite/:id (visitor).
import { useEffect, useState } from 'react';

export type Route =
  | { space: 'creator'; page: 'dashboard' | 'tours' | 'publications' | 'analytics' | 'ai-builder' | 'team' | 'subscription' | 'settings' }
  | { space: 'studio'; projectId?: string }
  | { space: 'visitor'; page: 'explorer' }
  | { space: 'visitor'; page: 'tour'; projectId: string }
  | { space: 'auth'; page: 'login' | 'signup'; next?: string };

const CREATOR_PAGES = ['tours', 'publications', 'analytics', 'ai-builder', 'team', 'subscription', 'settings'] as const;

export function parseRoute(hash: string): Route {
  const [pathPart, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b] = parts;
  if (a === 'login' || a === 'signup') {
    const next = new URLSearchParams(query).get('next') ?? undefined;
    // Only internal paths are accepted as redirect targets.
    return { space: 'auth', page: a, next: next && next.startsWith('/') && !next.startsWith('//') ? next : undefined };
  }
  if (a === 'studio') return { space: 'studio', projectId: b };
  if (a === 'explorer') return { space: 'visitor', page: 'explorer' };
  if (a === 'visite' && b) return { space: 'visitor', page: 'tour', projectId: b };
  if ((CREATOR_PAGES as readonly string[]).includes(a)) return { space: 'creator', page: a as (typeof CREATOR_PAGES)[number] };
  return { space: 'creator', page: 'dashboard' };
}

/** Optional guard (e.g. unsaved Studio changes). Returning false cancels navigation. */
let guard: (() => boolean) | null = null;
export const setNavigationGuard = (g: (() => boolean) | null) => {
  guard = g;
};

export function navigate(path: string) {
  if (guard && !guard()) return;
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    let last = location.hash;
    const on = () => {
      // Back/forward buttons bypass navigate(): apply the guard here too.
      if (guard && !guard()) {
        history.replaceState(null, '', last);
        return;
      }
      last = location.hash;
      setRoute(parseRoute(location.hash));
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
