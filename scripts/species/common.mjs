// Shared helpers for the flora/fauna pipeline: file cache, polite HTTP with retries, bounded concurrency.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CACHE_DIRECTORY = 'tmp/species-cache';
export const USER_AGENT = 'Mozilla/5.0 AtlasNusantaraResearch/0.1 (species layer; contact: repository owner)';

export const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function readCache(name) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIRECTORY, name), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writeCache(name, value) {
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  await writeFile(path.join(CACHE_DIRECTORY, name), JSON.stringify(value));
}

/** GET with retries on 429/5xx and network errors. Throws on any other non-2xx status. */
export async function fetchText(url, { attempts = 5, headers = {} } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, signal: AbortSignal.timeout(60000) });
      if (response.ok) return await response.text();
      if (response.status === 404) return undefined;
      if (response.status !== 429 && response.status < 500) throw new Error('HTTP ' + response.status + ' for ' + url);
      lastError = new Error('HTTP ' + response.status + ' for ' + url);
    } catch (error) {
      if (String(error.message).startsWith('HTTP 4')) throw error;
      lastError = error;
    }
    await sleep(1000 * attempt * attempt);
  }
  throw lastError;
}

export async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  // Some GBIF endpoints answer 200 or 204 with an empty body when there is nothing to report.
  if (text === undefined || text.trim() === '') return undefined;
  return JSON.parse(text);
}

/** Runs `worker` over `items` with at most `limit` in flight; reports progress every `every` items. */
export async function mapConcurrent(items, limit, worker, { every = 500, label = 'items' } = {}) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
      done++;
      if (done % every === 0) console.log(label + ': ' + done + '/' + items.length);
    }
  }
  await Promise.all(Array.from({ length: limit }, lane));
  return results;
}

export function normaliseName(name) {
  return name.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Checklist backbone plus the species that other sources add (see resolve-names.mjs). */
export async function loadAllSpecies() {
  const backbone = await readCache('backbone.json');
  if (!backbone) throw new Error('Run build-backbone.mjs first');
  const extras = (await readCache('extras.json')) ?? [];
  return [...backbone, ...extras];
}

/** Name to GBIF key: exact backbone names first, then the GBIF-matched synonyms written by resolve-names.mjs. */
export function makeKeyResolver(species, resolution = {}) {
  const keyByName = new Map(species.map(item => [normaliseName(item.name), item.gbifKey]));
  return name => keyByName.get(normaliseName(name)) ?? resolution[normaliseName(name)] ?? undefined;
}
