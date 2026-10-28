/// <reference lib="webworker" />
import { version } from '$service-worker';
import { officialWarningUrl, parseNotification } from './lib/pwa/notification-payload';
import { isDeferredAtlasAsset, isValidShellAssetList } from './lib/pwa/cache-policy';
import { readNotificationsEnabled } from './lib/pwa/notification-settings';
declare const self: ServiceWorkerGlobalScope;

const cacheName = 'nusantara-' + version;
// The generated manifest contains only URLs needed to render and hydrate the initial shell.
const SHELL_MANIFEST = '/pwa-shell.json';

async function readShellAssets(): Promise<string[]> {
 const response = await fetch(SHELL_MANIFEST, { cache: 'no-store' });
 if (!response.ok) throw new Error('Shell cache manifest request failed: ' + response.status);
 const manifest: unknown = await response.json();
 if (!manifest || typeof manifest !== 'object' || !('assets' in manifest) || !isValidShellAssetList(manifest.assets)) {
  throw new Error('Shell cache manifest is invalid');
 }
 return manifest.assets;
}

function isCacheableAtlasAsset(path: string): boolean {
 if (path.startsWith('/_app/immutable/')) return true;
 if (path.startsWith('/data/admin-2025/cities/') || path.startsWith('/data/geometry-2025/')) return true;
 return isDeferredAtlasAsset(path);
}

self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const assets = await readShellAssets();
  const cache = await caches.open(cacheName);
  await cache.addAll(assets);
 })());
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
   if (response.ok && isCacheableAtlasAsset(url.pathname)) {
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
 event.waitUntil(readNotificationsEnabled().then(enabled => {
  if (!enabled) return;
  return self.registration.showNotification(notification.title, {
   body: notification.body, icon: '/icon-192.png', tag: notification.id,
   data: { url: notification.url, source: notification.source, expiresAt: notification.expiresAt }
  });
 }).catch(error => console.warn('Notification suppressed because settings or delivery are unavailable', error)));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const data = event.notification.data;
 const url = officialWarningUrl(data?.url, data?.source);
 if (!url) return;
 event.waitUntil(self.clients.openWindow(url));
});
