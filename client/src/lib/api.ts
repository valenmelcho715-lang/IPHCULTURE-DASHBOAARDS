// ============================================================
// lib/api.ts — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// Cliente HTTP para la API. Uso:
//   import { api } from '../lib/api';
//   const data = await api.get<Venta[]>('/api/ventas');
//   await api.post('/api/ventas', body);
// Lanza Error con el mensaje del servidor si falla.
// ============================================================

const TOKEN_KEY = 'ic_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.includes('/auth/login')) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('Sesión expirada');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const fmtUSD = (n: number | null | undefined): string =>
  `USD ${Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export const fmtARS = (n: number | null | undefined): string =>
  `$ ${Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export const fmtFecha = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = soloFecha
    ? new Date(`${iso}T12:00:00`) // fecha sin hora: interpretar como día local
    : new Date(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  return soloFecha
    ? d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
