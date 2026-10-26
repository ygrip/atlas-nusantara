// Polite HTTP client for the pipeline: identifying User-Agent, timeout, size cap and bounded retry on 429/5xx.
const USER_AGENT = 'nusantara-atlas-pipeline/1.0 (+https://github.com/gdncomm)';
const MAX_RETRY_WAIT_MS = 30_000;
/** Only the reviewed provider hosts may be contacted, including after redirects. */
export const ALLOWED_HOSTS = new Set([
  'www.bmkg.go.id', 'data.petabencana.id', 'gis.bnpb.go.id', 'www.antaranews.com', 'antaranews.com', 'api.gdeltproject.org'
]);

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function retryWaitMs(response, attempt, baseDelayMs) {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return Math.min(retryAfterSeconds * 1000, MAX_RETRY_WAIT_MS);
  return Math.min(baseDelayMs * (attempt + 1), MAX_RETRY_WAIT_MS);
}

function isRetryable(status) {
  return status === 429 || status >= 500;
}

async function readLimitedText(response, maxBytes) {
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw Error('Response exceeds the ' + maxBytes + ' byte limit');
  return new TextDecoder('utf-8').decode(buffer);
}

function assertAllowedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname)) throw Error('Unapproved pipeline origin: ' + url.hostname);
}

/** Fetches text. Throws on a non-2xx status after the retries are used up. */
export async function fetchText(url, options = {}) {
  const { method = 'GET', body, headers = {}, timeoutMs = 25_000, maxBytes = 4_000_000, retries = 2, retryDelayMs = 6_000 } = options;
  assertAllowedUrl(url);
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method, body, headers: { 'User-Agent': USER_AGENT, ...headers }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow'
    });
    if (response.url) assertAllowedUrl(response.url);
    if (response.ok) return readLimitedText(response, maxBytes);
    lastStatus = response.status;
    const canRetry = isRetryable(response.status) && attempt < retries;
    if (!canRetry) break;
    await sleep(retryWaitMs(response, attempt, retryDelayMs));
  }
  throw Error(url + ': HTTP ' + lastStatus);
}

export { sleep };
