import type { ForecastPoint, ForecastSnapshot, ForecastStep } from '../map/weather.ts';

export interface PlaceRequest { type: 'region' | 'coordinates'; code?: string; lat?: number; lng?: number }
export interface PlaceForecast { point: ForecastPoint; step: ForecastStep; upcoming: ForecastStep[]; distanceKm?: number }

export function distanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const radians = Math.PI / 180;
  const dLat = (latB - latA) * radians;
  const dLon = (lonB - lonA) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latA * radians) * Math.cos(latB * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/** Province cards show an explicitly identified sample in that province, not a fictitious province-wide forecast. */
export function forecastForPlace(snapshot: ForecastSnapshot, place: PlaceRequest, now: number): PlaceForecast | undefined {
  let candidates = snapshot.points;
  if (place.type === 'region') candidates = candidates.filter(point => point.code === place.code || point.code.startsWith(place.code + '.'));
  if (candidates.length === 0) return undefined;
  let lat = place.lat;
  let lon = place.lng;
  if (lat === undefined || lon === undefined) {
    lat = candidates.reduce((sum, point) => sum + point.lat, 0) / candidates.length;
    lon = candidates.reduce((sum, point) => sum + point.lon, 0) / candidates.length;
  }
  const targetLat = lat;
  const targetLon = lon;
  const ranked = [...candidates].sort((a, b) => distanceKm(targetLat, targetLon, a.lat, a.lon) - distanceKm(targetLat, targetLon, b.lat, b.lon));
  const point = ranked[0];
  if (point.steps.length === 0) return undefined;
  let closest = 0;
  for (let index = 1; index < point.steps.length; index++) {
    if (Math.abs(Date.parse(point.steps[index].at) - now) < Math.abs(Date.parse(point.steps[closest].at) - now)) closest = index;
  }
  const result: PlaceForecast = { point, step: point.steps[closest], upcoming: point.steps.slice(closest, closest + 4) };
  if (place.type === 'coordinates') result.distanceKm = distanceKm(targetLat, targetLon, point.lat, point.lon);
  return result;
}
