import type { HistoricalPolity, HistoryCategory, HistoryZone } from '../data/history.ts';
export interface HistoryZoneMarker extends HistoryZone {
  id: string;
  name: string;
  category: HistoryCategory;
  polity: HistoricalPolity;
}
export function historyMarkerActive(zone: HistoryZoneMarker, year: number): boolean {
  return zone.polity.from <= year && year <= zone.polity.to
    && (zone.from ?? zone.polity.from) <= year && year <= (zone.to ?? zone.polity.to);
}

/** Stable polity-specific hues; category and religion are not encoded as colour. */
export function historyPolityColor(id: string): string {
  if (id === 'indonesia') return '#FF0000';
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hue = (hash >>> 0) % 36000 / 100;
  const saturation = 60 + (hash >>> 16) % 18;
  const lightness = 38 + (hash >>> 24) % 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
/** An archaeological site, not a state or a capital. Dates describe the excavated Buni phase. */
export const BATUJAYA_SITE = {
  name: 'Batujaya · Buni', lon: 107.1514, lat: -6.0572, from: -100, to: 200,
  source: 'https://www.persee.fr/doc/befeo_0336-1519_2015_num_101_1_6212'
};

export function influenceOpacity(confidence: HistoryZone['confidence']): number {
  if (confidence === 'attested-centre') return 0.78;
  if (confidence === 'approximate-core') return 0.55;
  return 0.28;
}
/** One degree of latitude ~111 km; a sphere of influence is a soft schematic halo. */
export function historyRadiusDegrees(km: number, latitude: number): number {
  // Longitude stretches at high latitudes; the archipelago only spans low latitudes.
  return Math.min(20, km / (111.32 * Math.max(0.4, Math.cos(latitude * Math.PI / 180))));
}
