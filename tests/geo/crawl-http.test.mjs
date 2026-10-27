import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CrawlClient } from '../../scripts/destinations/crawl-http.mjs';

async function withCache(run) {
  const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), 'nusantara-crawl-'));
  try {
    await run(cacheDirectory);
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }
}

function successfulResponse(body = 'page') {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
}

test('persists successful responses and resumes from cache without another request', async () => {
  await withCache(async cacheDirectory => {
    let requests = 0;
    const client = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => { requests++; return successfulResponse('<main>listing</main>'); },
      pause: async () => {}
    });
    const first = await client.get('/browse?cat=0');
    const resumed = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => { requests++; throw Error('cache should avoid network'); },
      pause: async () => {}
    });

    assert.equal(first.body, '<main>listing</main>');
    assert.equal(first.url, 'https://direktoripariwisata.id/browse?cat=0');
    assert.equal((await resumed.get('/browse?cat=0')).fetchedAt, first.fetchedAt);
    assert.equal(requests, 1);
  });
});

test('backs off for 429 Retry-After, then retries the same URL', async () => {
  await withCache(async cacheDirectory => {
    let requests = 0;
    const pauses = [];
    const client = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => {
        requests++;
        if (requests === 1) return new Response('', { status: 429, headers: { 'retry-after': '8' } });
        return successfulResponse('retry succeeded');
      },
      pause: async milliseconds => { pauses.push(milliseconds); }
    });

    const result = await client.get('/browse/pg-1');
    assert.equal(result.body, 'retry succeeded');
    assert.equal(requests, 2);
    assert.ok(pauses.includes(8000));
  });
});

test('does not retry a forbidden response', async () => {
  await withCache(async cacheDirectory => {
    let requests = 0;
    const client = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => { requests++; return new Response('blocked', { status: 403 }); },
      pause: async () => {}
    });

    await assert.rejects(client.get('/browse/pg-1'), /Crawler HTTP 403/);
    assert.equal(requests, 1);
  });
});

test('stops at redirects and rejects cross-origin targets without fetching', async () => {
  await withCache(async cacheDirectory => {
    let requests = 0;
    const client = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => { requests++; return new Response(null, { status: 302, headers: { location: 'https://other.example/data' } }); },
      pause: async () => {}
    });

    await assert.rejects(client.get('/browse/pg-1'), /stopped at redirect/);
    await assert.rejects(client.get('https://other.example/data'), /configured origin/);
    assert.equal(requests, 1);
  });
});

test('rejects malformed cached response instead of silently replacing it', async () => {
  await withCache(async cacheDirectory => {
    const url = 'https://direktoripariwisata.id/browse/pg-2';
    const filename = createHash('sha256').update(url).digest('hex') + '.json';
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, filename), JSON.stringify({ url, body: 'cached', fetchedAt: 'not-a-date' }));
    let requests = 0;
    const client = new CrawlClient({
      origin: 'https://direktoripariwisata.id', cacheDirectory, delayMs: 0,
      fetcher: async () => { requests++; return successfulResponse('fresh'); },
      pause: async () => {}
    });

    await assert.rejects(client.get(url), /Invalid crawl cache entry/);
    assert.equal(requests, 0);
  });
});
