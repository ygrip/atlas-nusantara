/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
import { officialWarningUrl, parseNotification } from './lib/pwa/notification-payload';
declare const self: ServiceWorkerGlobalScope;

const cacheName = 'nusantara-' + version;
// Cache the shell, not every province or provider snapshot on installation.
const assets = [...build, ...files, '/200.html'].filter(path =>
 !path.startsWith('/data/snapshots/') && !path.startsWith('/data/geometry-2025/') &&
 !path.startsWith('/data/admin-2025/cities/') && path !== '/data/admin-2025/cities.json' &&
 path !== '/_app/version.json' && path !== '/service-worker.js' && !path.startsWith('/data/published/'));
const assetPaths = new Set(assets);

self.addEventListener('install', event => {
 event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
 event.waitUntil(Promise.all([
  caches.keys().then(keys => {
   const previous = keys.filter(key => key.startsWith('nusantara-') && key !== cacheName);
   return Promise.all(previous.slice(0, -1).map(key => caches.delete(key)));
  }),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
 // Network-only source snapshots must never silently become "current" offline data.
 if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/snapshots/') || url.pathname.startsWith('/data/published/') || url.pathname === '/_app/version.json' || url.pathname === '/service-worker.js') return;
 event.respondWith((async () => {
  try {
   const response = await fetch(event.request);
   const isRegionAsset = url.pathname.startsWith('/data/admin-2025/cities/') || url.pathname.startsWith('/data/geometry-2025/');
   if (response.ok && (assetPaths.has(url.pathname) || isRegionAsset)) {
    const cache = await caches.open(cacheName);
    await cache.put(event.request, response.clone());
   }
   if (response.status === 404 && url.pathname.startsWith('/_app/immutable/')) {
    const previous = await caches.match(event.request, { ignoreSearch: true });
    if (previous) return previous;
   }
   return response;
  } catch {
   const cache = await caches.open(cacheName);
   let cached = await cache.match(event.request, { ignoreSearch: true });
   if (!cached && url.pathname.startsWith('/_app/immutable/')) cached = await caches.match(event.request, { ignoreSearch: true });
   if (cached) return cached;
   if (event.request.mode === 'navigate') {
    const fallback = await cache.match('/200.html');
    if (fallback) return fallback;
   }
   return Response.error();
  }
 })());
});
self.addEventListener('message', event => {
 if (event.data?.type !== 'SKIP_WAITING' || !event.source || !('id' in event.source)) return;
 const clientId = event.source.id;
 if (typeof clientId !== 'string') return;
 event.waitUntil(self.clients.get(clientId).then(client => {
  if (client && new URL(client.url).origin === self.location.origin) return self.skipWaiting();
 }));
});
self.addEventListener('push', event => {
 if (!event.data) return;
 let payload: unknown;
 try { payload = event.data.json(); } catch { return; }
 const notification = parseNotification(payload);
 if (!notification) return;
 event.waitUntil(self.registration.showNotification(notification.title, {
  body: notification.body, icon: '/icon-192.png', tag: notification.id,
  data: { url: notification.url, source: notification.source, expiresAt: notification.expiresAt }
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const data = event.notification.data;
 const url = officialWarningUrl(data?.url, data?.source);
 if (!url) return;
 event.waitUntil(self.clients.openWindow(url));
});
