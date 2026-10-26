// Builds a dated BMKG weather forecast snapshot for one representative village per city/regency.
// The atlas animates wind, cloud, rain and sea state from this snapshot; it never calls BMKG at runtime.
//
// Source: BMKG public forecast API (https://data.bmkg.go.id/prakiraan-cuaca/), 60 requests/minute/IP.
// Attribution to BMKG is mandatory wherever the data is shown.
//
// Usage: node scripts/ingestion/forecast-snapshot.mjs [output.json]
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const API = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=';
const REQUEST_GAP_MS = 1100;
const output = process.argv[2] ?? 'static/data/weather/forecast.json';
const { edition, points } = JSON.parse(await readFile('static/data/admin-2025/forecast-points.json', 'utf8'));

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function normaliseName(name) {
  return name.toLowerCase().replace(/^(kabupaten|kab\.)\s+/, '').replace(/administrasi|adm\./g, '').replace(/[^a-z]/g, '');
}

/** Keeps the fields the map needs; drops provider icons and free text beyond the short English description. */
function compactStep(step) {
  return {
    at: step.datetime,
    t: step.t,
    hu: step.hu,
    tcc: step.tcc,
    tp: step.tp,
    weather: step.weather,
    desc: step.weather_desc_en,
    wd: step.wd_deg,
    ws: step.ws
  };
}

async function fetchPoint(point) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(API + point.adm4, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'nusantara-atlas snapshot (github.com/ygrip/nusantara)' } });
      if (response.status === 429) { await sleep(10000 * attempt); continue; }
      if (!response.ok) throw Error('HTTP ' + response.status);
      const payload = await response.json();
      const location = payload.lokasi ?? payload.data?.[0]?.lokasi;
      const steps = (payload.data?.[0]?.cuaca ?? []).flat();
      if (!location || steps.length === 0) throw Error('Empty forecast');
      const expectedCode = point.providerCode ?? point.code;
      if (String(location.adm2) !== expectedCode || normaliseName(location.kotkab) !== normaliseName(point.expectedName)) {
        throw Error('Provider region differs from the verified code/name crosswalk');
      }
      if (!Number.isFinite(Number(location.lon)) || !Number.isFinite(Number(location.lat))) throw Error('Invalid forecast coordinates');
      return { code: point.code, providerCode: expectedCode, name: location.kotkab, adm4: point.adm4, lon: Number(location.lon), lat: Number(location.lat), fetchedAt: new Date().toISOString(), steps: steps.map(compactStep) };
    } catch (error) {
      if (attempt === 3) { console.warn('skip', point.code, point.adm4, error.message); return undefined; }
      await sleep(2000 * attempt);
    }
  }
  return undefined;
}

const results = [];
for (const [index, point] of points.entries()) {
  const started = Date.now();
  const result = await fetchPoint(point);
  if (result) results.push(result);
  if (index % 50 === 0) console.log(index + 1, '/', points.length);
  await sleep(Math.max(0, REQUEST_GAP_MS - (Date.now() - started)));
}

if (results.length < Math.ceil(points.length * 0.9)) throw Error('Fewer than 90% of forecast points succeeded; previous snapshot retained');
const analysisTimes = results.flatMap(result => result.steps.map(step => step.at)).sort();
const snapshot = {
  schemaVersion: 1,
  kind: 'forecast-snapshot',
  source: 'BMKG',
  sourceUrl: 'https://data.bmkg.go.id/prakiraan-cuaca/',
  attribution: 'Weather forecast data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika).',
  codeEdition: edition,
  fetchedAt: new Date().toISOString(),
  validFrom: analysisTimes[0],
  validTo: analysisTimes[analysisTimes.length - 1],
  units: { t: '°C', hu: '%', tcc: '%', tp: 'mm', wd: 'degrees, direction the wind comes from', ws: 'km/h' },
  coverage: { requested: points.length, received: results.length },
  points: results
};
await mkdir(dirname(output), { recursive: true });
const temporary = output + '.tmp';
await writeFile(temporary, JSON.stringify(snapshot));
await rename(temporary, output);
console.log('Wrote', output, results.length, 'of', points.length, 'points');
