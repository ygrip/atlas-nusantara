import { browser } from '$app/environment';
export type Pin =
 | { id: string; type: 'region'; code: string; name: string; addedAt: string }
 | { id: string; type: 'coordinates'; lat: number; lng: number; name: string; addedAt: string };
const storageKey = 'nusantara:pins:v1';
const regionCodePattern = /^\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?$/;
const coordinateIdPattern = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
 return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPin(value: unknown): value is Pin {
 if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || value.name.trim() === '' || typeof value.addedAt !== 'string' || !Number.isFinite(Date.parse(value.addedAt))) return false;
 if (value.type === 'region') {
  return typeof value.code === 'string' && regionCodePattern.test(value.code) && value.id === 'region:' + value.code;
 }
 if (value.type === 'coordinates') {
  if (typeof value.lat !== 'number' || typeof value.lng !== 'number' || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return false;
  if (value.lat < -90 || value.lat > 90 || value.lng < -180 || value.lng > 180) return false;
  const match = coordinateIdPattern.exec(value.id);
  if (!match) return false;
  return Number(match[1]) === value.lat && Number(match[2]) === value.lng;
 }
 return false;
}

export function readPins(): Pin[] {
 if (!browser) return [];
 const raw = localStorage.getItem(storageKey);
 if (raw === null) return [];
 const items: unknown = JSON.parse(raw);
 if (!Array.isArray(items)) return [];
 const uniquePins = new Map<string, Pin>();
 for (const item of items) {
  if (isValidPin(item) && !uniquePins.has(item.id)) uniquePins.set(item.id, item);
  if (uniquePins.size === 30) break;
 }
 return [...uniquePins.values()];
}

export function writePins(pins: Pin[]): void {
 if (!browser) return;
 localStorage.setItem(storageKey, JSON.stringify(pins.slice(0, 30)));
}
export function requestPosition():Promise<GeolocationCoordinates> {
 return new Promise((resolve,reject)=>{
  if(!browser||!navigator.geolocation) return reject(new Error('Geolocation is unavailable'));
  navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),reject,{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 });
}
export async function requestNotifications(): Promise<NotificationPermission> {
 if (!browser || !('Notification' in window) || !('serviceWorker' in navigator)) throw Error('Notifications are unavailable');
 return Notification.requestPermission();
}
