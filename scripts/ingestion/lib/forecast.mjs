// BMKG forecast point fetching, shared by the CLI snapshot script and the Cloudflare Worker refresh.
// Source: https://data.bmkg.go.id/prakiraan-cuaca/ (60 requests/minute/IP). Attribution to BMKG is mandatory wherever it is shown.
export const FORECAST_API = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=';
export const FORECAST_USER_AGENT = 'nusantara-atlas snapshot (github.com/ygrip/nusantara)';

export function normaliseName(name) {
  return name.toLowerCase().replace(/^(kabupaten|kab\.)\s+/, '').replace(/administrasi|adm\./g, '').replace(/[^a-z]/g, '');
}

/** Keeps the fields the map needs; drops provider icons and free text beyond the short English description. */
export function compactStep(step) {
  return { at: step.datetime, t: step.t, hu: step.hu, tcc: step.tcc, tp: step.tp, weather: step.weather, desc: step.weather_desc_en, wd: step.wd_deg, ws: step.ws };
}

function sleepFor(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Throws when the provider answered for a different region than the verified code/name crosswalk expects. */
function verifiedPoint(point, payload, fetchedAt) {
  const location = payload.lokasi ?? payload.data?.[0]?.lokasi;
  const steps = (payload.data?.[0]?.cuaca ?? []).flat();
  if (!location || steps.length === 0) throw Error('Empty forecast');
  const expectedCode = point.providerCode ?? point.code;
  if (String(location.adm2) !== expectedCode || normaliseName(location.kotkab) !== normaliseName(point.providerName ?? point.expectedName)) {
    throw Error('Provider region differs from the verified code/name crosswalk');
  }
  if (!Number.isFinite(Number(location.lon)) || !Number.isFinite(Number(location.lat))) throw Error('Invalid forecast coordinates');
  return { code: point.code, providerCode: expectedCode, name: location.kotkab, adm4: point.adm4, lon: Number(location.lon), lat: Number(location.lat), fetchedAt, steps: steps.map(compactStep) };
}

/**
 * Fetches one point. Returns { result } on success, otherwise { error, rateLimited }.
 * The CLI retries up to 3 times with waits; the Worker passes attempts: 1 because every attempt is a subrequest.
 */
export async function fetchForecastPoint(point, { fetcher = fetch, attempts = 3, sleep = sleepFor, now = () => new Date() } = {}) {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetcher(FORECAST_API + point.adm4, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': FORECAST_USER_AGENT } });
      if (response.status === 429) {
        lastError = 'HTTP 429';
        if (attempt === attempts) return { error: lastError, rateLimited: true };
        await sleep(10000 * attempt);
        continue;
      }
      if (!response.ok) throw Error('HTTP ' + response.status);
      return { result: verifiedPoint(point, await response.json(), now().toISOString()) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) await sleep(2000 * attempt);
    }
  }
  return { error: lastError, rateLimited: false };
}
