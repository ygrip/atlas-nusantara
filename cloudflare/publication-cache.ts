interface CacheContext {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

/** Cache only public, successful JSON. Query strings do not create extra D1 cache keys. */
export async function cachedPublication(context: CacheContext, load: () => Promise<Response>): Promise<Response> {
  const request = context.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') return load();
  if (typeof caches === 'undefined') return load();
  const cache = caches.default;
  const url = new URL(request.url);
  url.search = '';
  const key = new Request(url, { method: 'GET' });
  const cached = await cache.match(key);
  if (cached) {
    const validUntil = Date.parse(cached.headers.get('x-publication-valid-until') ?? '');
    if (Number.isFinite(validUntil) && validUntil > Date.now()) {
      if (request.method === 'HEAD') return new Response(null, cached);
      return cached;
    }
    await cache.delete(key);
  }
  const response = await load();
  if (request.method === 'GET' && response.ok && response.headers.get('content-type')?.startsWith('application/json')) {
    const validUntil = Date.parse(response.headers.get('x-publication-valid-until') ?? '');
    if (Number.isFinite(validUntil) && validUntil > Date.now()) {
      const write = cache.put(key, response.clone()).catch(error => {
        console.warn(JSON.stringify({ message: 'publication-cache-write-failed', path: url.pathname, error: String(error) }));
      });
      if (context.waitUntil) context.waitUntil(write);
      else await write;
    }
  }
  return response;
}
