export type PinSymbol = 'circle' | 'triangle' | 'diamond';
export interface MapPin {
  id: string;
  lon: number;
  lat: number;
  label: string;
  description?: string;
  value?: number;
  /** Optional category color and shape, overriding the layer default. */
  color?: string;
  symbol?: PinSymbol;
  /** Province summary identity, not an individual attraction's coordinate. */
  provinceCode?: string;
}
export interface OverlayLegend { label: string; color: string; symbol: PinSymbol }
export interface PointOverlay {
  id: string;
  color: string;
  symbol: PinSymbol;
  pins: MapPin[];
  legend: OverlayLegend[];
  source: string;
  sourceUrl?: string;
  attribution?: string;
  unit?: string;
  fetchedAt: string;
}

/** Add a definition and a dated PointOverlay JSON asset to introduce another point dataset. */
export interface OverlayDefinition {
  id: string;
  label: () => string;
  source: string;
  renderer: 'weather' | 'points' | 'unavailable';
  icon: 'weather' | 'earthquake' | 'incident' | 'hazard' | 'mountain' | 'landmark';
  snapshotUrl?: string;
}

/** Strict, bounded input contract for future mountains, volcanoes or landmark layers. No executable provider plugins. */
export function validatePointOverlay(value: unknown): value is PointOverlay {
  if (!value || typeof value !== 'object') return false;
  const overlay = value as PointOverlay;
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(overlay.id) || !/^#[0-9a-fA-F]{6}$/.test(overlay.color)) return false;
  if (!['circle', 'triangle', 'diamond'].includes(overlay.symbol)) return false;
  if (!overlay.source || !Number.isFinite(Date.parse(overlay.fetchedAt)) || !Array.isArray(overlay.pins) || overlay.pins.length > 10000) return false;
  const ids = new Set<string>();
  for (const pin of overlay.pins) {
    if (!pin.id || ids.has(pin.id) || typeof pin.label !== 'string' || pin.label.length > 300) return false;
    if (!Number.isFinite(pin.lon) || !Number.isFinite(pin.lat) || Math.abs(pin.lon) > 180 || Math.abs(pin.lat) > 90) return false;
    if (pin.value !== undefined && !Number.isFinite(pin.value)) return false;
    if (pin.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(pin.color)) return false;
    if (pin.symbol !== undefined && !['circle', 'triangle', 'diamond'].includes(pin.symbol)) return false;
    if (pin.provinceCode !== undefined && !/^\d{2}$/.test(pin.provinceCode)) return false;
    ids.add(pin.id);
  }
  return Array.isArray(overlay.legend) && overlay.legend.length <= 20 && overlay.legend.every(item => typeof item.label === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color) && ['circle', 'triangle', 'diamond'].includes(item.symbol));
}

export async function loadPointOverlay(url: string, signal?: AbortSignal): Promise<PointOverlay | undefined> {
  if (!url.startsWith('/data/') || url.startsWith('//')) throw Error('Overlay snapshots must be local data assets');
  const response = await fetch(url, { signal });
  if (!response.ok) return undefined;
  const payload = await response.json();
  if (!validatePointOverlay(payload)) throw Error('Invalid point overlay');
  return payload;
}
