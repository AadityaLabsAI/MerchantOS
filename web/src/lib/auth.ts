import { create } from 'zustand';
import * as api from '@/lib/api';

type Me = {
  id: string;
  email: string;
  name?: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  merchantId: string;
  storeId: string | null;
  permissions: string[];
};

type State = {
  me: Me | null;
  status: 'idle' | 'loading' | 'authed' | 'guest';
  load: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<State>((set) => ({
  me: null,
  status: 'idle',
  async load() {
    api.loadTokensFromStorage();
    if (!api.getRefreshToken()) { set({ status: 'guest', me: null }); return; }
    try {
      if (!api.getAccessToken()) {
        const r = await fetch('/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: api.getRefreshToken() }),
        });
        if (!r.ok) throw new Error('refresh failed');
        const data = await r.json();
        api.setTokens(data.accessToken, data.refreshToken);
      }
      const me = await api.fetchMe();
      set({ me: { ...me, role: (me as any).role } as Me, status: 'authed' });
    } catch {
      set({ me: null, status: 'guest' });
    }
  },
  async logout() {
    await api.logout();
    set({ me: null, status: 'guest' });
  },
}));
