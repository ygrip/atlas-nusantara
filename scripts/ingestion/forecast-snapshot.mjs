// Builds a dated BMKG weather forecast snapshot for one representative village per city/regency.
// The atlas animates wind, cloud, rain and sea state from this snapshot; it never calls BMKG at runtime.
//
// Source: BMKG public forecast API (https://data.bmkg.go.id/prakiraan-cuaca/), 60 requests/minute/IP.
// Attribution to BMKG is mandatory wherever the data is shown.
//
// Usage: node scripts/ingestion/forecast-snapshot.mjs [output.json]
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchForecastPoint } from './lib/forecast.mjs';

const REQUEST_GAP_MS = 1100;
const output = process.argv[2] ?? 'static/data/weather/forecast.json';
const { edition, points } = JSON.parse(await readFile('static/data/admin-2025/forecast-points.json', 'utf8'));

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchPoint(point) {
  const { result, error } = await fetchForecastPoint(point, { sleep });
  if (!result) console.warn('skip', point.code, point.adm4, error);
  return result;
}

const results = [];
/** Cities BMKG gave no usable forecast for; the atlas shows the nearest forecast for them, with a note. */
const unavailable = [];
for (const [index, point] of points.entries()) {
  const started = Date.now();
  const result = await fetchPoint(point);
  if (result) results.push(result);
  else unavailable.push({ code: point.code, lat: point.lat, lon: point.lon });
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
  points: results,
  unavailable
};
await mkdir(dirname(output), { recursive: true });
const temporary = output + '.tmp';
await writeFile(temporary, JSON.stringify(snapshot));
await rename(temporary, output);
console.log('Wrote', output, results.length, 'of', points.length, 'points');
