/**
 * Resumable image-search scrape (Bing by default, Google optional) for destinations without a photo, driven by a
 * local camofox-browser server (https://github.com/jo-inc/camofox-browser).
 *
 * Usage:
 *   node scripts/destinations/scrape-google-images.mjs
 *   node scripts/destinations/scrape-google-images.mjs --limit=50 --province=34
 *   node scripts/destinations/scrape-google-images.mjs --images=4 --concurrency=3   # defaults
 *   node scripts/destinations/scrape-google-images.mjs --after=sisparnas-24702 --delay-ms=6000
 *   node scripts/destinations/scrape-google-images.mjs --retry-empty
 *   node scripts/destinations/scrape-google-images.mjs --engine=duckduckgo
 *   node scripts/destinations/scrape-google-images.mjs --engine=google   # often CAPTCHA-blocked
 *
 * Progress is appended to research/google-images-progress.jsonl, one line per
 * destination. Rerun the same command after any interruption to continue.
 * Exit codes: 0 finished/limit reached, 1 repeated errors, 2 search engine blocked us.
 */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  appendProgress, isFinished, loadProgress, parseCsvRecords, selectWebImageUrls, MAX_WEB_IMAGES
} from './google-image-progress.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DEFAULT_CSV = path.join(ROOT, 'research/missing-destination-images.csv');
export const DEFAULT_PROGRESS = path.join(ROOT, 'research/google-images-progress.jsonl');

export const SEARCH_BAR = "//textarea[(@name='q')]";
export const IMAGE_BAR = "//div[@role='navigation']//div[@role='list']//div[contains(., 'Images') or contains(., 'Gambar')]";
export const IMAGE_RESULTS = "//div[@data-id='mosaic']/*/*/div[position() <= 8]//div[@data-img-wrapper]//img[@src]";

const GOOGLE_HOME = 'https://www.google.com/?hl=en';
const BING_HOME = 'https://www.bing.com/';
const HOME_URLS = { google: GOOGLE_HOME, bing: BING_HOME, duckduckgo: 'https://duckduckgo.com/' };
// Fresh user per run: camofox's persisted storage state can fail to reload (setRequestInterception error).
const USER_ID = 'nusantara-images-' + Date.now();
// Workers share the error counter, so one outage counts once per worker.
const MAX_CONSECUTIVE_ERRORS = 12;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const MAX_NAME_WORDS = 6;

/**
 * SISPARNAS names sometimes contain a whole address, e.g.
 * "PEDATI KUNO Kalianyar -Krangkeng (Desa Wisata Sejarah, ... Jawa-Barat)".
 * Search engines return nothing for such queries, so keep the leading name words.
 */
export function simplifySearchQuery(row) {
  const cleanName = row.destination_name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(^|\s)-+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const shortName = cleanName.split(' ').slice(0, MAX_NAME_WORDS).join(' ');
  return [shortName, row.district, row.province, 'Indonesia'].filter(Boolean).join(' ');
}

export class GoogleBlockedError extends Error {}

/** DuckDuckGo result tiles are <ol><li><figure><div><img>. Favicons use a different proxy path (/ip3/). */
export function readDuckDuckGoResultsExpression() {
  return `(() => [...document.querySelectorAll('ol li figure img')]
    .map(image => image.src)
    .filter(source => source.includes('/iu/?u='))
  )()`;
}

export function duckDuckGoSearchUrl(query) {
  return 'https://duckduckgo.com/?' + new URLSearchParams({ q: query, iax: 'images', ia: 'images' });
}

/**
 * DuckDuckGo proxies Bing thumbnails (u=https://tse3.mm.bing.net/th/id/OIP.x). Unwrap those to the
 * same stable th.bing.com URL as the Bing engine. Anything else keeps its DuckDuckGo proxy URL.
 */
export function duckDuckGoThumbnailUrl(proxied) {
  let underlying;
  try { underlying = new URL(new URL(proxied).searchParams.get('u')); } catch { return undefined; }
  const bingPath = underlying.pathname.match(/^\/th\/id\/([A-Za-z0-9._-]{5,80})$/);
  if (underlying.hostname.endsWith('.mm.bing.net') && bingPath) return 'https://th.bing.com/th/id/' + bingPath[1];
  if (proxied.startsWith('https://external-content.duckduckgo.com/iu/?u=')) return proxied;
  return undefined;
}

export async function searchDuckDuckGoImages(session, query, { pause = sleep, timeoutMs = 20_000 } = {}) {
  await session.navigate(duckDuckGoSearchUrl(query));
  const found = await pollUntil(session, async () => {
    const results = await session.evaluate(readDuckDuckGoResultsExpression());
    if (results.length > 0) return results;
    return undefined;
  }, { timeoutMs, pause });
  if (!found) return { sources: [] };
  await pause(1000);
  const settled = await session.evaluate(readDuckDuckGoResultsExpression());
  return { sources: settled.map(duckDuckGoThumbnailUrl).filter(Boolean) };
}

/** Bing tile anchors carry JSON in `m`: turl = Bing thumbnail, murl = original image. */
export function readBingResultsExpression() {
  return `(() => {
    const results = [];
    for (const anchor of document.querySelectorAll('a.iusc')) {
      try {
        const data = JSON.parse(anchor.getAttribute('m'));
        results.push({ thumbnail: data.turl, original: data.murl });
      } catch (error) { /* tile without metadata */ }
    }
    return results;
  })()`;
}

export function bingSearchUrl(query) {
  return 'https://www.bing.com/images/search?' + new URLSearchParams({ q: query, form: 'HDRSC2' });
}

/**
 * Bing thumbnails are served from a stable, hotlinkable host. Original-site
 * URLs often block hotlinking or vanish, so the thumbnail is what we publish.
 */
export function bingThumbnailUrl(thumbnail) {
  let id;
  try { id = new URL(thumbnail).searchParams.get('id'); } catch { return undefined; }
  if (!id || !/^[A-Za-z0-9._-]{5,80}$/.test(id)) return undefined;
  return 'https://th.bing.com/th/id/' + id;
}

/** Search Bing Images with a direct URL. Returns thumbnails plus original URLs. */
export async function searchBingImages(session, query, { pause = sleep, timeoutMs = 20_000 } = {}) {
  await session.navigate(bingSearchUrl(query));
  const tiles = await pollUntil(session, async () => {
    const state = await session.evaluate('location.href');
    if (/bing\.com\/(sorry|Challenge)/i.test(state)) throw new GoogleBlockedError('Bing challenge page: ' + state.slice(0, 80));
    const found = await session.evaluate(readBingResultsExpression());
    if (found.length > 0) return found;
    return undefined;
  }, { timeoutMs, pause });
  if (!tiles) return { sources: [], originals: [] };
  await pause(1000);
  const settled = await session.evaluate(readBingResultsExpression());
  const sources = settled.map(tile => bingThumbnailUrl(tile.thumbnail)).filter(Boolean);
  return { sources, originals: settled.map(tile => tile.original).filter(Boolean).slice(0, MAX_WEB_IMAGES) };
}

/** Evaluated inside the page. Returns every matching img src, in document order. */
export function readImageResultsExpression() {
  return `(() => {
    const snapshot = document.evaluate(${JSON.stringify(IMAGE_RESULTS)}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const sources = [];
    for (let index = 0; index < snapshot.snapshotLength; index++) sources.push(snapshot.snapshotItem(index).src);
    return sources;
  })()`;
}

/**
 * IMAGE_BAR also matches every ancestor div that contains the word, so click
 * the anchor of the innermost match rather than the first (outermost) one.
 */
export function openImagesTabExpression() {
  return `(() => {
    const snapshot = document.evaluate(${JSON.stringify(IMAGE_BAR)}, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let index = snapshot.snapshotLength - 1; index >= 0; index--) {
      const anchor = snapshot.snapshotItem(index).closest('a');
      if (anchor) { anchor.click(); return true; }
    }
    return false;
  })()`;
}

export function pageStateExpression() {
  return `({
    url: location.href,
    hasSearchBar: document.evaluate(${JSON.stringify(SEARCH_BAR)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue !== null
  })`;
}

export class CamofoxSession {
  constructor({ baseUrl, homeUrl = GOOGLE_HOME, userId = USER_ID, fetcher = fetch, pause = sleep }) {
    this.baseUrl = baseUrl;
    this.homeUrl = homeUrl;
    this.userId = userId;
    this.fetcher = fetcher;
    this.pause = pause;
    this.tabId = undefined;
  }

  async call(method, route, body) {
    const response = await this.fetcher(this.baseUrl + route, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Error(`camofox ${method} ${route} -> ${response.status} ${payload.error ?? ''}`.trim());
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async openTab() {
    const payload = await this.call('POST', '/tabs', { userId: this.userId, sessionKey: 'images', url: this.homeUrl });
    this.tabId = payload.tabId;
  }

  async navigate(url) {
    return this.call('POST', `/tabs/${this.tabId}/navigate`, { userId: this.userId, url });
  }

  async evaluate(expression) {
    const payload = await this.call('POST', `/tabs/${this.tabId}/evaluate`, { userId: this.userId, expression });
    return payload.result;
  }

  async type(text) {
    return this.call('POST', `/tabs/${this.tabId}/type`, {
      userId: this.userId, selector: 'xpath=' + SEARCH_BAR, text, mode: 'keyboard', delay: 60, pressEnter: true
    });
  }

  async close() {
    await this.call('DELETE', `/sessions/${this.userId}`).catch(() => {});
  }
}

function assertNotBlocked(url) {
  if (typeof url === 'string' && url.includes('/sorry/')) {
    throw new GoogleBlockedError('Google showed its unusual-traffic page: ' + url.slice(0, 80));
  }
}

async function pollUntil(session, check, { timeoutMs, intervalMs = 500, pause = sleep }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() >= deadline) return undefined;
    await pause(intervalMs);
  }
}

/** Search one query and return the raw src list of the first image tiles. */
export async function searchImageSources(session, query, { pause = sleep, timeoutMs = 20_000 } = {}) {
  await session.navigate(GOOGLE_HOME);
  const home = await session.evaluate(pageStateExpression());
  assertNotBlocked(home?.url);
  if (!home?.hasSearchBar) throw new Error('Google search bar not found at ' + home?.url);
  await session.type(query);

  const results = await pollUntil(session, async () => {
    const state = await session.evaluate(pageStateExpression());
    assertNotBlocked(state?.url);
    if (state.url.includes('/search') && state.hasSearchBar) return state;
    return undefined;
  }, { timeoutMs, pause });
  if (!results) throw new Error('Search results did not load');

  const clicked = await session.evaluate(openImagesTabExpression());
  if (!clicked) throw new Error('Images/Gambar tab not found');

  const sources = await pollUntil(session, async () => {
    const state = await session.evaluate(pageStateExpression());
    assertNotBlocked(state?.url);
    const found = await session.evaluate(readImageResultsExpression());
    if (found.length > 0) return found;
    return undefined;
  }, { timeoutMs, pause });
  if (!sources) return [];
  // Tiles fill in progressively; give them a moment, then read the settled list.
  await pause(1500);
  return session.evaluate(readImageResultsExpression());
}

export function remainingDestinations(rows, progress, { province, after, limit, retryEmpty }) {
  const pending = [];
  for (const row of rows) {
    if (province && row.province_code !== province) continue;
    if (after && row.destination_id.localeCompare(after, 'en', { numeric: true }) <= 0) continue;
    if (isFinished(progress.get(row.destination_id), { retryEmpty })) continue;
    pending.push(row);
    if (pending.length >= limit) break;
  }
  return pending;
}

function parseOptions(args) {
  const options = { limit: Infinity, delayMs: 4000, baseUrl: 'http://localhost:9377', retryEmpty: false, engine: 'bing', images: 4, concurrency: 3,
    csv: DEFAULT_CSV, progress: DEFAULT_PROGRESS };
  for (const arg of args) {
    const [flag, value] = arg.split('=');
    if (flag === '--limit' && /^\d+$/.test(value)) options.limit = Number(value);
    else if (flag === '--province' && /^\d{2}$/.test(value)) options.province = value;
    else if (flag === '--after' && value) options.after = value;
    else if (flag === '--delay-ms' && /^\d+$/.test(value)) options.delayMs = Number(value);
    else if (flag === '--base-url' && value) options.baseUrl = value;
    else if (flag === '--csv' && value) options.csv = path.resolve(value);
    else if (flag === '--progress' && value) options.progress = path.resolve(value);
    else if (flag === '--images' && /^[1-8]$/.test(value)) options.images = Number(value);
    else if (flag === '--concurrency' && /^[1-6]$/.test(value)) options.concurrency = Number(value);
    else if (flag === '--engine' && ['bing', 'google', 'duckduckgo'].includes(value)) options.engine = value;
    else if (flag === '--retry-empty') options.retryEmpty = true;
    else throw Error('Invalid option: ' + arg);
  }
  return options;
}

async function searchWithEngine(session, query, options, pause) {
  if (options.engine === 'google') return { sources: await searchImageSources(session, query, { pause }) };
  if (options.engine === 'duckduckgo') return searchDuckDuckGoImages(session, query, { pause });
  return searchBingImages(session, query, { pause });
}

/** One worker owns one camofox session/tab and pulls destinations from the shared queue. */
async function runWorker(workerNumber, queue, state, options, { pause, log }) {
  const session = new CamofoxSession({
    baseUrl: options.baseUrl,
    userId: `${USER_ID}-w${workerNumber}`,
    homeUrl: HOME_URLS[options.engine]
  });
  try {
    while (!state.stop) {
      const row = queue.shift();
      if (!row) return;
      try {
        if (!session.tabId) await session.openTab();
        let query = row.search_query;
        let { sources, originals } = await searchWithEngine(session, query, options, pause);
        let images = selectWebImageUrls(sources, options.images);
        const simplified = simplifySearchQuery(row);
        if (images.length === 0 && simplified !== query) {
          query = simplified;
          ({ sources, originals } = await searchWithEngine(session, query, options, pause));
          images = selectWebImageUrls(sources, options.images);
        }
        await appendProgress(options.progress, {
          destinationId: row.destination_id,
          query,
          engine: options.engine,
          ...(originals ? { originalUrls: originals.slice(0, options.images) } : {}),
          status: images.length ? 'ok' : 'empty',
          images,
          tilesSeen: sources.length,
          scrapedAt: new Date().toISOString()
        });
        state.consecutiveErrors = 0;
        state.done++;
        log(`[${state.done}/${state.total}] ${row.destination_id} ${row.destination_name}: ${images.length} images (${sources.length} tiles)`);
      } catch (error) {
        if (error instanceof GoogleBlockedError) {
          log(`BLOCKED after ${state.done} destinations. Progress is saved; rerun later or change IP. ${error.message}`);
          state.blocked = true;
          state.stop = true;
          return;
        }
        state.consecutiveErrors++;
        log(`error on ${row.destination_id}: ${error.message.split('\n')[0]} (${state.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
        session.tabId = undefined; // reopen a clean tab after any failure
        if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) { state.stop = true; return; }
        // Transient network/browser blips clear up; wait longer after each repeated failure.
        const waitMs = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (state.consecutiveErrors - 1));
        log(`backing off ${Math.round(waitMs / 1000)}s`);
        await pause(waitMs);
      }
      await pause(options.delayMs + Math.floor(Math.random() * options.delayMs / 2));
    }
  } finally {
    await session.close();
  }
}

export async function run(options, { pause = sleep, log = console.log } = {}) {
  const rows = parseCsvRecords(await readFile(options.csv, 'utf8'));
  const progress = await loadProgress(options.progress);
  const pending = remainingDestinations(rows, progress, options);
  log(`rows=${rows.length} finished=${progress.size} pending(this run)=${pending.length} images=${options.images} concurrency=${options.concurrency}`);

  const queue = [...pending];
  const state = { done: 0, total: pending.length, consecutiveErrors: 0, stop: false, blocked: false };
  const workers = [];
  for (let number = 1; number <= options.concurrency; number++) {
    workers.push(runWorker(number, queue, state, options, { pause, log }));
  }
  await Promise.all(workers);

  if (state.blocked) return { done: state.done, exitCode: 2 };
  if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS || (state.done === 0 && pending.length > 0)) return { done: state.done, exitCode: 1 };
  return { done: state.done, exitCode: 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(parseOptions(process.argv.slice(2)))
    .then(result => { console.log(JSON.stringify(result)); process.exitCode = result.exitCode; })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
