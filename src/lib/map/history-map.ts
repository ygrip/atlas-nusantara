import type { HistoryCategory, HistoryZone } from '$lib/data/history';
export interface HistoryZoneMarker extends HistoryZone {
  id: string;
  name: string;
  category: HistoryCategory;
}
/** Each hue represents a historical polity tradition, not a modern country. */
export const HISTORY_COLORS: Record<HistoryCategory, string> = {
  'hindu-buddhist': '#b88743',
  islamic: '#388b77',
  regional: '#b85c65',
  colonial: '#697a95'
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
