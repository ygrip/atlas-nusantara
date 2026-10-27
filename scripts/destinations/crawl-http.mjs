import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT = 'AtlasNusantaraResearch/0.1 (+https://github.com/ygrip/nusantara)';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/** One request at a time, persistent cache, bounded retries, no access-control bypass. */
export class CrawlClient {
  constructor({ origin, cacheDirectory, delayMs = 1000, timeoutMs = 30000, fetcher = fetch, pause = sleep }) {
    this.origin = new URL(origin).origin;
    this.cacheDirectory = cacheDirectory;
    this.delayMs = delayMs;
    this.timeoutMs = timeoutMs;
    this.fetcher = fetcher;
    this.pause = pause;
    this.lastRequest = 0;
  }

  async get(url) {
    return this.cached(url, {});
  }

  async evictGet(url) {
    const target = new URL(url, this.origin);
    if (target.origin !== this.origin) throw Error('Cache eviction must stay on the configured origin');
    const filename = createHash('sha256').update(target.href).digest('hex') + '.json';
    try { await unlink(path.join(this.cacheDirectory, filename)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  async postForm(url, fields) {
    const body = new URLSearchParams(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right))).toString();
    return this.cached(url, { method: 'POST', body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  }

  async cached(url, request) {
    const target = new URL(url, this.origin);
    if (target.origin !== this.origin) throw Error('Crawler URL must stay on the configured origin');
    let cacheKey = target.href;
    if (request.method === 'POST') cacheKey += '\nPOST\n' + request.body;
    const filename = createHash('sha256').update(cacheKey).digest('hex') + '.json';
    const cachePath = path.join(this.cacheDirectory, filename);
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'));
      if (cached.url !== target.href || typeof cached.body !== 'string' || !Number.isFinite(Date.parse(cached.fetchedAt))) {
        throw Error('Invalid crawl cache entry: ' + cachePath);
      }
      return cached;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const result = await this.request(target, request);
    await mkdir(this.cacheDirectory, { recursive: true });
    await writeFile(cachePath + '.partial', JSON.stringify(result));
    await rename(cachePath + '.partial', cachePath);
    return result;
  }

  async request(target, request) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.pause(Math.max(0, this.lastRequest + this.delayMs - Date.now()));
      this.lastRequest = Date.now();
      const response = await this.fetcher(target.href, {
        ...request,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json;q=0.9,*/*;q=0.1', ...request.headers },
        redirect: 'manual', signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (response.status >= 300 && response.status < 400) {
        throw Error('Crawler stopped at redirect; inspect before following: ' + target.href + ' -> ' + response.headers.get('location'));
      }
      if (RETRYABLE.has(response.status) && attempt < 3) {
        let delay = 5000 * (attempt + 1);
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter && /^\d+$/.test(retryAfter)) delay = Math.max(delay, Number(retryAfter) * 1000);
        if (delay > 120000) throw Error('Server requested a long pause; resume later: ' + target.href);
        console.warn('Crawler backing off:', response.status, delay, target.href);
        await response.body?.cancel();
        await this.pause(delay);
        continue;
      }
      if (!response.ok) throw Error('Crawler HTTP ' + response.status + ': ' + target.href);
      const body = await response.text();
      if (body.length > 5_000_000) throw Error('Crawler response exceeds 5 MB: ' + target.href);
      return { url: target.href, fetchedAt: new Date().toISOString(), body };
    }
    throw Error('Crawler retry limit reached: ' + target.href);
  }
}
