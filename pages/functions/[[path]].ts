import { coldDownload } from '../../cloudflare/worker.ts';
import type { ColdDownloadEnv } from '../../cloudflare/cold-download.ts';
import { noPublication, serveHot, servePublication } from '../../cloudflare/publication.ts';
import { cachedPublication } from '../../cloudflare/publication-cache.ts';
import { D1RateLimiter } from '../../cloudflare/rate-limit.ts';
import { secureApiResponse } from '../../cloudflare/security.ts';
import { liveKeyForPath } from '../../cloudflare/live-snapshots.ts';

type LimiterBinding = 'COLD_REQUEST_LIMITER' | 'COLD_EXPORT_LIMITER' | 'COLD_BUDGET_LIMITER';
type PagesEnv = Omit<Env, LimiterBinding> & Pick<ColdDownloadEnv, 'TURNSTILE_SECRET'>;
interface PagesContext {
  request: Request;
  env: PagesEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function archiveEnvironment(env: PagesEnv) {
  return {
    ...env,
    COLD_REQUEST_LIMITER: new D1RateLimiter(env.DB, 'archive-request', 10, 60),
    COLD_EXPORT_LIMITER: new D1RateLimiter(env.DB, 'archive-download', 2, 60),
    COLD_BUDGET_LIMITER: new D1RateLimiter(env.DB, 'archive-global', 20, 60)
  };
}

async function routeRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const path = new URL(request.url).pathname;
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Cross-site API requests are not allowed.' }, { status: 403 });
  }
  if (path === '/api/export') return coldDownload(request, archiveEnvironment(env), Date.now());
  if (path.startsWith('/data/published/')) {
    return cachedPublication(context, () => serveHot(request, env.DB));
  }
  const liveKey = liveKeyForPath(path);
  if (liveKey) return cachedPublication(context, () => servePublication(request, env.DB, liveKey));
  if (path === '/data/live/hazards.json') {
    if (!env.HAZARD_SOURCE_IDS?.trim()) return noPublication();
    return cachedPublication(context, () => servePublication(request, env.DB, 'data/observations/hazards.json'));
  }
  return Response.json({ error: 'Not found.' }, { status: 404 });
}

/** Static requests bypass Functions. Every API response receives its own security headers. */
export async function onRequest(context: PagesContext): Promise<Response> {
  try {
    return secureApiResponse(await routeRequest(context));
  } catch (error) {
    let message = String(error);
    if (error instanceof Error) message = error.message;
    console.error(JSON.stringify({ message: 'pages-request-failed', path: new URL(context.request.url).pathname, error: message }));
    return secureApiResponse(Response.json({ status: 'unavailable' }, { status: 503 }));
  }
}
