import { browser } from '$app/environment';
export type Pin =
 | { id: string; type: 'region'; code: string; name: string; addedAt: string }
 | { id: string; type: 'coordinates'; lat: number; lng: number; name: string; addedAt: string };
const storageKey='nusantara:pins:v1';
export function readPins():Pin[] {
 if(!browser) return [];
 try {
  const items:unknown=JSON.parse(localStorage.getItem(storageKey)??'[]');
  return Array.isArray(items)?items.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&(x.type==='region'||(x.type==='coordinates'&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)))).slice(0,30):[];
 } catch { return []; }
}
export function writePins(pins:Pin[]):void {
 if(browser) localStorage.setItem(storageKey,JSON.stringify(pins.slice(0,30)));
}
export function requestPosition():Promise<GeolocationCoordinates> {
 return new Promise((resolve,reject)=>{
  if(!browser||!navigator.geolocation) return reject(new Error('Geolocation is unavailable'));
  navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),reject,{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 });
}
export async function requestNotifications():Promise<NotificationPermission> {
 if(!browser||!('Notification' in window)||!('serviceWorker' in navigator)) throw Error('Notifications are unavailable');
 const permission=await Notification.requestPermission();
 if(permission==='granted'){
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification('Nusantara',{body:'Notifications enabled on this device.',icon:'/icon.svg'});
 }
 return permission;
}
