// BMKG M5+ earthquake archive parsing, shared by the CLI snapshot script and the Cloudflare Worker refresh.
export const EARTHQUAKE_SOURCE_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';

export function buildEarthquakeArchive(payload, fetchedAt) {
  if (!Array.isArray(payload?.Infogempa?.gempa)) throw Error('Unexpected BMKG archive format');
  const events = payload.Infogempa.gempa.map(item => {
    const [lat, lon] = item.Coordinates.split(',').map(Number);
    const magnitude = Number(item.Magnitude);
    const depthKm = Number(item.Kedalaman.replace(/\s*km$/i, ''));
    const observedAt = new Date(item.DateTime).toISOString();
    if (![lat, lon, magnitude, depthKm].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Error('Invalid BMKG event');
    return { id: observedAt + ':' + lon + ':' + lat, observedAt, lat, lon, magnitude, depthKm, place: String(item.Wilayah), potential: String(item.Potensi ?? '') };
  });
  return {
    schemaVersion: 1, kind: 'earthquake-archive', source: 'BMKG', sourceUrl: EARTHQUAKE_SOURCE_URL, termsUrl: 'https://data.bmkg.go.id/gempabumi/',
    attribution: 'Earthquake observations: BMKG. Historical observations, not predictions or an emergency alert service.', fetchedAt,
    coverage: 'The events included in the BMKG M5+ archive, not every earthquake.', events
  };
}
