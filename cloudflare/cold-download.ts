interface Limiter { limit(options: { key: string }): Promise<{ success: boolean }> }
export interface ColdDownloadEnv {
  TURNSTILE_SECRET?: string;
  TURNSTILE_HOSTNAMES: string;
  COLD_REQUEST_LIMITER: Limiter;
  COLD_EXPORT_LIMITER: Limiter;
  COLD_BUDGET_LIMITER: Limiter;
}
export interface ArchiveRequest { kind: 'warning' | 'earthquake' | 'incident' | 'hazard'; format: 'json' | 'csv'; from: string; to: string }

function reject(status: number, reason: string): Response {
  const headers = new Headers({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  if (status === 429) headers.set('retry-after', '60');
  if (status === 405) headers.set('allow', 'POST');
  return Response.json({ status: 'unavailable', reason }, { status, headers });
}

async function boundedText(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) throw Error('Missing body');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > 8192) throw Error('Body too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch (error) { await reader.cancel(error); throw error; }
  finally { reader.releaseLock(); }
}

function archiveWindow(input: Record<string, unknown>, now = Date.now()): { from: string; to: string } {
  const day = 86400000;
  const today = new Date(now).toISOString().slice(0, 10);
  let from = input.from;
  let to = input.to;
  if (from === undefined || from === '') from = new Date(now - 30 * day).toISOString().slice(0, 10);
  if (to === undefined || to === '') to = today;
  for (const value of [from, to]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('Invalid UTC archive date');
  }
  const start = Date.parse(String(from));
  const end = Date.parse(String(to)) + day;
  const earliest = Date.parse(new Date(now - 365 * day).toISOString().slice(0, 10));
  if (start < earliest || end > Date.parse(today) + day || end <= start || end - start > 31 * day) throw Error('Choose up to 31 UTC days within the retained year');
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

async function readArchiveRequest(request: Request): Promise<ArchiveRequest & { token: string }> {
  const text = await boundedText(request.body);
  let input: Record<string, unknown>;
  const contentType = request.headers.get('content-type')?.split(';')[0].trim();
  if (contentType === 'application/json') input = JSON.parse(text);
  else if (contentType === 'application/x-www-form-urlencoded') input = Object.fromEntries(new URLSearchParams(text));
  else throw Error('Unsupported request content type');
  if (!input || typeof input.kind !== 'string' || !['warning', 'earthquake', 'incident', 'hazard'].includes(input.kind)) throw Error('Invalid kind');
  if (input.format !== 'json' && input.format !== 'csv') throw Error('Invalid format');
  const token = input['cf-turnstile-response'] ?? input.token;
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) throw Error('Invalid verification token');
  return { kind: input.kind as ArchiveRequest['kind'], format: input.format, token, ...archiveWindow(input) };
}

/** Bot verification, not visitor identity. No D1 call occurs before this succeeds. */
export async function verifyArchiveRequest(request: Request, env: ColdDownloadEnv, fetcher: typeof fetch = fetch): Promise<ArchiveRequest | Response> {
  if (request.method !== 'POST') return reject(405, 'Use a verified POST to download the cold archive.');
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return reject(403, 'The download must originate from this website.');
  const hostnames = new Set(env.TURNSTILE_HOSTNAMES.split(',').map(value => value.trim()).filter(Boolean));
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!env.TURNSTILE_SECRET || !hostnames.has(url.hostname) || (!local && (hostnames.has('localhost') || hostnames.has('127.0.0.1')))) return reject(503, 'Archive verification is not configured.');
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip || !/^[\da-f:.]{3,45}$/i.test(ip)) return reject(403, 'Client network verification is unavailable.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  if (!(await env.COLD_REQUEST_LIMITER.limit({ key })).success) return reject(429, 'Too many archive requests.');
  let input: Awaited<ReturnType<typeof readArchiveRequest>>;
  try { input = await readArchiveRequest(request); }
  catch { return reject(400, 'A bounded download request and a fresh verification token are required.'); }
  try {
    const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: input.token, remoteip: ip })
    });
    if (!verification.ok) throw Error('Siteverify returned HTTP ' + verification.status);
    const result = JSON.parse(await boundedText(verification.body));
    if (result.success !== true || result.action !== 'archive_download' || result.hostname !== url.hostname || !hostnames.has(result.hostname)) return reject(403, 'Verification failed or expired. Complete a fresh challenge.');
  } catch (error) {
    console.warn(JSON.stringify({ message: 'archive-siteverify-unavailable', error: 'Verification service failed' }));
    return reject(403, 'Verification is temporarily unavailable.');
  }
  if (!(await env.COLD_EXPORT_LIMITER.limit({ key })).success) return reject(429, 'Archive download limit reached.');
  if (!(await env.COLD_BUDGET_LIMITER.limit({ key: 'archive-downloads' })).success) return reject(429, 'The archive download budget is temporarily exhausted.');
  return { kind: input.kind, format: input.format, from: input.from, to: input.to };
}
