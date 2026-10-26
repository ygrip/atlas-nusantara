// Fetches a dated BMKG M5+ earthquake archive once. The browser reads only the local snapshot.
import { mkdir, writeFile, rename } from 'node:fs/promises';
const sourceUrl = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw Error('BMKG archive: HTTP ' + response.status);
const payload = await response.json();
if (!Array.isArray(payload.Infogempa?.gempa)) throw Error('Unexpected BMKG archive format');
const events = payload.Infogempa.gempa.map(item => {
  const [lat, lon] = item.Coordinates.split(',').map(Number);
  const magnitude = Number(item.Magnitude);
  const depthKm = Number(item.Kedalaman.replace(/\s*km$/i, ''));
  const observedAt = new Date(item.DateTime).toISOString();
  if (![lat, lon, magnitude, depthKm].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Error('Invalid BMKG event');
  return { id: observedAt + ':' + lon + ':' + lat, observedAt, lat, lon, magnitude, depthKm, place: String(item.Wilayah), potential: String(item.Potensi ?? '') };
});
const output = 'static/data/observations/earthquakes.json';
await mkdir('static/data/observations', { recursive: true });
await writeFile(output + '.tmp', JSON.stringify({ schemaVersion: 1, kind: 'earthquake-archive', source: 'BMKG', sourceUrl, termsUrl: 'https://data.bmkg.go.id/gempabumi/', attribution: 'Earthquake observations: BMKG. Historical observations, not predictions or an emergency alert service.', fetchedAt: new Date().toISOString(), coverage: 'The events included in the BMKG M5+ archive, not every earthquake.', events }));
await rename(output + '.tmp', output);
console.log('Saved', events.length, 'dated BMKG earthquake observations');
