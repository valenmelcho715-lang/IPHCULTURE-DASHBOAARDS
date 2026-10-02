// ============================================================
// lib/push.ts — Suscripción a notificaciones push (web push)
// Uso:
//   const estado = await estadoPush();            // 'activado' | 'desactivado' | 'denegado' | 'no-soportado'
//   await activarPush();                          // registra SW, pide permiso, suscribe y guarda en el server
//   await desactivarPush();                       // desuscribe y avisa al server
// ============================================================
import { api } from './api';

export type PushEstado = 'no-soportado' | 'denegado' | 'activado' | 'desactivado';

export function pushSoportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registrarSW(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  // Esperar a que el SW quede activo antes de suscribir
  await navigator.serviceWorker.ready;
  return reg;
}

/** Estado actual de las notificaciones push para este navegador. */
export async function estadoPush(): Promise<PushEstado> {
  if (!pushSoportado()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'denegado';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? 'activado' : 'desactivado';
  } catch {
    return 'desactivado';
  }
}

/** Registra el SW, pide permiso, suscribe al push manager y guarda en el server. */
export async function activarPush(): Promise<void> {
  if (!pushSoportado()) throw new Error('Este navegador no soporta notificaciones push');
  const reg = await registrarSW();
  const { key } = await api.get<{ key: string }>('/api/push/vapid-public-key');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  await api.post('/api/push/subscribe', sub.toJSON());
}

/** Desuscribe este navegador y elimina la suscripción en el server. */
export async function desactivarPush(): Promise<void> {
  if (!pushSoportado()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => undefined);
    await api.post('/api/push/unsubscribe', { endpoint }).catch(() => undefined);
  }
}
