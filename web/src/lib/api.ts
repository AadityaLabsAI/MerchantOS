// Centralized API client. Bearer auth, automatic refresh on 401.

const BASE = '/api';
const AUTH_BASE = '/auth';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();
export function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify() { listeners.forEach((fn) => fn()); }

export function setTokens(at: string | null, rt: string | null) {
  accessToken = at;
  refreshToken = rt;
  if (rt) localStorage.setItem('mos_refresh', rt);
  else localStorage.removeItem('mos_refresh');
  notify();
}

export function loadTokensFromStorage() {
  refreshToken = localStorage.getItem('mos_refresh');
  notify();
}

export function getAccessToken() { return accessToken; }
export function getRefreshToken() { return refreshToken; }
export function isAuthenticated() { return !!accessToken; }

async function doRefresh(): Promise<void> {
  if (!refreshToken) throw new Error('no refresh token');
  const r = await fetch(AUTH_BASE + '/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) {
    setTokens(null, null);
    throw new Error('refresh failed');
  }
  const data = await r.json();
  setTokens(data.accessToken, data.refreshToken);
}

async function ensureRefresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const url = path.startsWith('/auth') ? AUTH_BASE + path.slice(5)
              : path.startsWith('/api') ? path
              : BASE + path;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
  const r = await fetch(url, { ...init, headers });
  if (r.status === 401 && refreshToken && !retried) {
    try { await ensureRefresh(); } catch { throw new ApiError(r.status, await safeJson(r)); }
    return request<T>(path, init, true);
  }
  if (!r.ok) throw new ApiError(r.status, await safeJson(r));
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return r.json() as Promise<T>;
  return (await r.text()) as unknown as T;
}

class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message || body?.error?.message || ('HTTP ' + status));
  }
}
export { ApiError };

async function safeJson(r: Response) {
  try { return await r.json(); } catch { return null; }
}

export const api = {
  get:    <T>(p: string) => request<T>(p),
  post:   <T>(p: string, body?: any) => request<T>(p, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch:  <T>(p: string, body?: any) => request<T>(p, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T>(p: string, body?: any) => request<T>(p, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del:    <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

// Auth helpers
export async function login(email: string, password: string) {
  const r = await fetch(AUTH_BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new ApiError(r.status, await safeJson(r));
  const data = await r.json();
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(email: string, password: string, name?: string) {
  const r = await fetch(AUTH_BASE + '/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!r.ok) throw new ApiError(r.status, await safeJson(r));
  const data = await r.json();
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function fetchMe() {
  return api.get<{ id: string; email: string; name?: string; role: string; merchantId: string; storeId: string | null; permissions: string[] }>('/auth/me');
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch {}
  setTokens(null, null);
}
