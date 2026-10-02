// ============================================================
// sw.js — Service Worker de notificaciones push (iPhone Culture)
// push → showNotification · notificationclick → enfocar/abrir app
// ============================================================
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data ? event.data.text() : '' };
    } catch {
      data = {};
    }
  }
  const title = data.title || 'iPhone Culture';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'iphone-culture',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(self.location.origin) && 'focus' in w) {
            w.navigate(url);
            return w.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
