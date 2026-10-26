/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
declare const self: ServiceWorkerGlobalScope;
const cacheName = 'nusantara-' + version;
const assets = [...build, ...files, '/200.html'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(cacheName).then(c => c.addAll(assets)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('nusantara-')&&k!==cacheName).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
 if(new URL(event.request.url).pathname.startsWith('/api/')) return;
 event.respondWith((async()=>{
  try {
   const response=await fetch(event.request);
   if(response.ok && assets.some(path=>new URL(path,self.location.origin).pathname===new URL(event.request.url).pathname)) {
    const c=await caches.open(cacheName); await c.put(event.request,response.clone());
   }
   return response;
  } catch {
   const cached=await caches.match(event.request);
   if(cached) return cached;
   if(event.request.mode==='navigate') {
    const fallback=await caches.match('/200.html'); if(fallback) return fallback;
   }
   return Response.error();
  }
 })());
});
self.addEventListener('push', event => {
 if(!event.data) return;
 let obj;
 try { obj=event.data.json(); } catch { return; }
 if(!obj || typeof obj!=='object') return;
 const title=typeof obj.title==='string'?obj.title.slice(0,100):'Nusantara';
 const body=typeof obj.body==='string'?obj.body.slice(0,240):'';
 const url=typeof obj.url==='string'&&obj.url.startsWith('/')&&!obj.url.startsWith('//')?obj.url:'/';
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/icon.svg',tag:'nusantara',data:{url}}));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url=new URL(event.notification.data?.url??'/',self.location.origin);
 if(url.origin!==self.location.origin) return;
 event.waitUntil(self.clients.openWindow(url.href));
});
