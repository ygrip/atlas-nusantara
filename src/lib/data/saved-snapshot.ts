export function isBmkgSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && (host === 'bmkg.go.id' || host.endsWith('.bmkg.go.id'));
  } catch { return false; }
}

/** Build safe CDN/local candidates without ever sending a visitor's coordinates to a provider. */
export function snapshotCandidates(path: string, origin?: string): string[] {
  if (!path.startsWith('/data/') || path.startsWith('//')) throw Error('Snapshot path must be a local data asset');
  if (!origin) {
    if (path.split('?')[0] === '/data/observations/hazards.json') return ['/data/live/hazards.json', path];
    return [path];
  }
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('Snapshot CDN must be an HTTPS origin');
  const pathname = path.split('?')[0];
  return [new URL(pathname, base).href, path];
}

async function fetchCandidate(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) {
      // Release the discarded live response before falling back; do not leave a fetch pending.
      await response.body?.cancel();
      return undefined;
    }
    if (Number(response.headers.get('content-length')) > 2_000_000) throw Error('Snapshot exceeds its size budget');
    const reader = response.body?.getReader();
    if (!reader) throw Error('Snapshot body is missing');
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) { await reader.cancel(); throw Error('Snapshot exceeds its size budget'); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Prefer a scheduled CDN snapshot; retain the explicitly dated release asset as an offline/failure fallback. */
export async function loadSavedSnapshot<T>(
  path: string,
  accept: (value: unknown) => value is T,
  signal?: AbortSignal,
  origin = import.meta.env?.VITE_PUBLIC_SNAPSHOT_ORIGIN
): Promise<T | undefined> {
  let candidates = [path];
  try { candidates = snapshotCandidates(path, origin); }
  catch (error) { console.warn('Snapshot CDN configuration is invalid; using the dated release asset', error); }
  for (const url of candidates) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const payload = await fetchCandidate(url, signal);
      if (accept(payload)) return payload;
      if (payload !== undefined) console.warn('Snapshot schema rejected; trying the dated release fallback');
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('Snapshot fetch failed; trying the dated release fallback', error);
    }
  }
  return undefined;
}
