// Builds the daily weather history for one representative point per city/regency: the last seven full days.
// BMKG publishes forecasts only, so the history comes from Open-Meteo (model analysis for past days), CC BY 4.0.
// Days are calendar days in WIB (Asia/Jakarta, UTC+7) so every point shares one date axis.
//
// Usage: node scripts/ingestion/weather-history.mjs [output.json]
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const API = 'https://api.open-meteo.com/v1/forecast';
const DAILY = ['temperature_2m_mean', 'temperature_2m_min', 'temperature_2m_max', 'precipitation_sum', 'relative_humidity_2m_mean', 'cloud_cover_mean', 'wind_speed_10m_mean'];
const HISTORY_DAYS = 7;
const BATCH_SIZE = 40;
const BATCH_GAP_MS = 1500;
const MIN_SUCCESS_RATIO = 0.9;
const output = process.argv[2] ?? 'static/data/weather/history.json';
const { edition, points } = JSON.parse(await readFile('static/data/admin-2025/forecast-points.json', 'utf8'));

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function rounded(value, digits) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dailyColumn(daily, name, digits) {
  const column = daily[name];
  if (!Array.isArray(column)) return undefined;
  return column.map(value => rounded(value, digits));
}

async function fetchBatch(batch) {
  const query = new URLSearchParams({
    latitude: batch.map(point => point.lat).join(','),
    longitude: batch.map(point => point.lon).join(','),
    daily: DAILY.join(','),
    timezone: 'Asia/Jakarta',
    past_days: String(HISTORY_DAYS),
    forecast_days: '1'
  });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(API + '?' + query, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'nusantara-atlas history (github.com/ygrip/nusantara)' } });
      if (response.status === 429) { await sleep(15000 * attempt); continue; }
      if (!response.ok) throw Error('HTTP ' + response.status);
      const payload = await response.json();
      const results = Array.isArray(payload) ? payload : [payload];
      if (results.length !== batch.length) throw Error('Provider returned ' + results.length + ' locations for ' + batch.length);
      return results;
    } catch (error) {
      if (attempt === 4) { console.warn('skip batch starting at', batch[0].code, error.message); return undefined; }
      await sleep(3000 * attempt);
    }
  }
  return undefined;
}

/** The last HISTORY_DAYS entries before today's (partial) entry. */
function pastDays(days) {
  return days.slice(0, -1).slice(-HISTORY_DAYS);
}

function buildPoint(point, result) {
  const daily = result?.daily;
  const empty = { code: point.code, lat: point.lat, lon: point.lon, days: undefined };
  if (!daily || !Array.isArray(daily.time)) return empty;
  const keep = pastDays(daily.time);
  const from = daily.time.length - 1 - keep.length;
  const slice = column => column?.slice(from, from + keep.length);
  return {
    code: point.code, lat: point.lat, lon: point.lon,
    days: keep,
    tmean: slice(dailyColumn(daily, 'temperature_2m_mean', 1)),
    tmin: slice(dailyColumn(daily, 'temperature_2m_min', 1)),
    tmax: slice(dailyColumn(daily, 'temperature_2m_max', 1)),
    rain: slice(dailyColumn(daily, 'precipitation_sum', 1)),
    hu: slice(dailyColumn(daily, 'relative_humidity_2m_mean', 0)),
    tcc: slice(dailyColumn(daily, 'cloud_cover_mean', 0)),
    ws: slice(dailyColumn(daily, 'wind_speed_10m_mean', 1))
  };
}

const withCoordinates = points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
if (withCoordinates.length !== points.length) throw Error('Every forecast point needs lat/lon in forecast-points.json');

const built = [];
for (let start = 0; start < withCoordinates.length; start += BATCH_SIZE) {
  const batch = withCoordinates.slice(start, start + BATCH_SIZE);
  const results = await fetchBatch(batch);
  batch.forEach((point, index) => built.push(buildPoint(point, results?.[index])));
  console.log(Math.min(start + BATCH_SIZE, withCoordinates.length), '/', withCoordinates.length);
  await sleep(BATCH_GAP_MS);
}

const complete = built.filter(point => point.days && point.tmean);
if (complete.length < Math.ceil(points.length * MIN_SUCCESS_RATIO)) throw Error('Fewer than 90% of points returned history; previous history retained');

const days = [...new Set(complete.flatMap(point => point.days))].sort().slice(-HISTORY_DAYS);
const columns = ['tmean', 'tmin', 'tmax', 'rain', 'hu', 'tcc', 'ws'];

/** Aligns every point to the shared date axis; a day the provider did not return becomes null. */
function aligned(point) {
  const result = { code: point.code, lat: point.lat, lon: point.lon };
  for (const column of columns) {
    result[column] = days.map(day => {
      const index = point.days?.indexOf(day) ?? -1;
      if (index < 0) return null;
      return point[column]?.[index] ?? null;
    });
  }
  return result;
}

const history = {
  schemaVersion: 1,
  kind: 'weather-history',
  source: 'Open-Meteo',
  sourceUrl: 'https://open-meteo.com/',
  license: 'CC BY 4.0',
  attribution: 'Weather history: Open-Meteo.com (CC BY 4.0), model-based daily values for one representative point per city/regency.',
  codeEdition: edition,
  fetchedAt: new Date().toISOString(),
  timeZone: 'Asia/Jakarta',
  days,
  units: { tmean: '°C', tmin: '°C', tmax: '°C', rain: 'mm per day', hu: '%', tcc: '%', ws: 'km/h' },
  points: built.map(aligned)
};
await mkdir(dirname(output), { recursive: true });
const temporary = output + '.tmp';
await writeFile(temporary, JSON.stringify(history));
await rename(temporary, output);
console.log('Wrote', output, complete.length, 'of', points.length, 'points with history,', days.length, 'days');
