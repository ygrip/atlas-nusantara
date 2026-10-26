/**
 * Offline importer for BIG's named mountains and classified volcanoes.
 * The 1:250,000 national atlas is a named-feature inventory, not every summit.
 * "Other" means no matched official volcano class, NOT a certified inactive volcano.
 */
export const MOUNTAIN_SOURCE = 'https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_NKRI/MapServer/9';
export const VOLCANO_SOURCE = 'https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_Sebaran_GunungApi/MapServer/11';

export function mountainName(value) {
  return String(value ?? '').trim().replace(/^(?:G[.]?|Gn[.]?|Gunung|Mount|Mt[.]?)\s+/i, '').replace(/\s+/g, ' ');
}
export function mountainKey(value) {
  return mountainName(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function mountainCategory(type) {
  if (/^(?:Bawah Laut )?Tipe A$/i.test(String(type ?? ''))) return 'active';
  if (/^(?:Bawah Laut )?Tipe [BC]$/i.test(String(type ?? ''))) return 'potential';
  return 'other';
}
function coordinates(feature) {
  const { x, y } = feature.geometry ?? {};
  if (![x, y].every(Number.isFinite)) return null;
  // Exclude obviously unrelated coordinates and upstream projection mistakes.
  if (x < 94 || x > 142 || y < -12 || y > 7) return null;
  return { lon: Number(x.toFixed(5)), lat: Number(y.toFixed(5)) };
}
function distance(a, b) {
  return Math.hypot((a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180), a.lat - b.lat);
}
function elevation(feature) {
  const raw = feature.attributes?.KETINGGIAN;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= -10000 && raw <= 9000 ? Math.round(raw) : undefined;
}

export function makeMountainOverlay(peaks, volcanoes, fetchedAt) {
  const pins = [];
  const classified = [];
  for (const feature of volcanoes) {
    const coords = coordinates(feature);
    const name = mountainName(feature.attributes?.NAMA_OBJEK);
    if (!coords || !name) continue;
    const kind = mountainCategory(feature.attributes?.TIPE);
    const elevationMeters = elevation(feature);
    const pin = {
      id: 'big-volcano-' + feature.attributes.OBJECTID, ...coords, label: 'Gunung ' + name,
      category: kind, description: String(feature.attributes.TIPE ?? ''),
      ...(elevationMeters === undefined ? {} : { value: elevationMeters })
    };
    pins.push(pin);
    classified.push({ key: mountainKey(name), pin });
  }
  for (const feature of peaks) {
    const coords = coordinates(feature);
    const name = mountainName(feature.attributes?.NAMA_UNSUR || feature.attributes?.TOPONIM);
    if (!coords || !name) continue;
    const key = mountainKey(name);
    // Official datasets may contain slightly different coordinates for a single volcano.
    if (classified.some(other => other.key === key && distance(other.pin, coords) < 0.2)) continue;
    const pin = {
      id: 'big-mountain-' + feature.attributes.OBJECTID, ...coords,
      label: 'Gunung ' + name, category: 'other'
    };
    pins.push(pin);
  }
  pins.sort((a, b) => a.label.localeCompare(b.label, 'id') || a.id.localeCompare(b.id));
  const ids = new Set(pins.map(pin => pin.id));
  if (ids.size !== pins.length || pins.length === 0 || pins.length > 10000) throw Error('Incomplete or duplicate BIG mountain inventory');
  return {
    id: 'mountains', color: '#647e8a', symbol: 'triangle', source: 'Badan Informasi Geospasial (BIG)',
    sourceUrl: 'https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_NKRI/MapServer',
    attribution: 'BIG Atlas Nasional Indonesia (2021), national scale 1:250,000; volcano type layer is not a live hazard alert.',
    fetchedAt,
    legend: [
      { label: 'Type A volcano', color: '#ca5a48', symbol: 'triangle' },
      { label: 'Type B/C volcano', color: '#c99245', symbol: 'triangle' },
      { label: 'Other / unclassified mountain', color: '#647e8a', symbol: 'triangle' }
    ],
    pins
  };
}
