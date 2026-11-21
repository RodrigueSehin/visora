// Authenticated user session (creator space and Studio).
import { create } from 'zustand';
import { api, onAuthChange, refreshSession, setAccessToken } from '../services/api';

export type Org = { id: string; name: string; role: 'owner' | 'admin' | 'editor' | 'viewer' };
export type Me = { user: { id: string; email: string; name: string }; organizations: Org[] };

type SessionState = {
  status: 'unknown' | 'anonymous' | 'authenticated';
  me: Me | null;
  orgId: string | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; name: string; organizationName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const ORG_KEY = 'visora:org';

export const useSession = create<SessionState>((set, get) => {
  const loadMe = async () => {
    const me = await api<Me>('/api/auth/me');
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ORG_KEY);
    } catch {
      /* ignore */
    }
    const orgId = me.organizations.find((o) => o.id === saved)?.id ?? me.organizations[0]?.id ?? null;
    set({ me, orgId, status: 'authenticated' });
  };

  onAuthChange((ok) => {
    if (!ok && get().status === 'authenticated') set({ status: 'anonymous', me: null });
  });

  return {
    status: 'unknown',
    me: null,
    orgId: null,

    /** On load: the httpOnly refresh cookie (if any) restores the session. */
    async restore() {
      if (await refreshSession()) {
        try {
          await loadMe();
          return;
        } catch {
          /* fall through */
        }
      }
      set({ status: 'anonymous', me: null });
    },

    async login(email, password) {
      const r = await api<{ accessToken: string }>('/api/auth/login', { body: { email, password }, auth: false });
      setAccessToken(r.accessToken);
      await loadMe();
    },

    async signup(input) {
      const r = await api<{ accessToken: string }>('/api/auth/signup', { body: input, auth: false });
      setAccessToken(r.accessToken);
      await loadMe();
    },

    async logout() {
      await api('/api/auth/logout', { method: 'POST', auth: false }).catch(() => {});
      setAccessToken(null);
      set({ status: 'anonymous', me: null, orgId: null });
    },

    async updateName(name) {
      const me = await api<Me>('/api/auth/me', { method: 'PATCH', body: { name } });
      set({ me });
    },
  };
});

export const activeOrg = () => {
  const s = useSession.getState();
  return s.me?.organizations.find((o) => o.id === s.orgId) ?? null;
};
