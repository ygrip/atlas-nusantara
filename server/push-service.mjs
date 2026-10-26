import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const MAX_SUBSCRIPTIONS = 100_000;
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_WARNING_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_WARNING_VALIDITY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com'
]);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function isAuthorized(header, expectedToken) {
  if (typeof expectedToken !== 'string' || expectedToken.length < 32) return false;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(expectedToken);
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}

function getWarningBody(body) {
  if (typeof body !== 'string') return '';
  return body.trim().slice(0, 240);
}

function isValidRegionCode(code, regionCodes) {
  return typeof code === 'string' && regionCodes.has(code);
}

function validateSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    throw new HttpError(400, 'Invalid subscription');
  }
  let endpoint;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    throw new HttpError(400, 'Invalid push endpoint');
  }
  if (endpoint.protocol !== 'https:' || !ALLOWED_PUSH_HOSTS.has(endpoint.hostname) || endpoint.port || endpoint.username || endpoint.password || endpoint.hash) {
    throw new HttpError(400, 'Unsupported push endpoint');
  }
  const keys = subscription.keys;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    throw new HttpError(400, 'Subscription keys are required');
  }
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{16,100}$/.test(keys.auth)) {
    throw new HttpError(400, 'Invalid subscription keys');
  }
  return { endpoint: endpoint.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function normalizeWarning(warning, regionCodes, now = Date.now()) {
  if (!warning || typeof warning !== 'object') return null;
  if (!['BMKG', 'BNPB'].includes(warning.source)) return null;
  if (typeof warning.id !== 'string' || warning.id.length < 1 || warning.id.length > 200) return null;
  if (typeof warning.title !== 'string' || warning.title.trim().length === 0) return null;
  if (typeof warning.url !== 'string') return null;
  let sourceUrl;
  try {
    sourceUrl = new URL(warning.url);
  } catch {
    return null;
  }
  let allowedHost = 'bmkg.go.id';
  if (warning.source === 'BNPB') allowedHost = 'bnpb.go.id';
  const hostMatches = sourceUrl.hostname === allowedHost || sourceUrl.hostname.endsWith('.' + allowedHost);
  if (sourceUrl.protocol !== 'https:' || !hostMatches || sourceUrl.port || sourceUrl.username || sourceUrl.password || sourceUrl.hash) return null;
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
  if (typeof warning.issuedAt !== 'string' || typeof warning.expiresAt !== 'string' || !isoTimestamp.test(warning.issuedAt) || !isoTimestamp.test(warning.expiresAt)) return null;
  const issuedAt = Date.parse(warning.issuedAt);
  const expiresAt = Date.parse(warning.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (issuedAt > now || expiresAt <= now || now - issuedAt > MAX_WARNING_AGE_MS || expiresAt <= issuedAt || expiresAt - issuedAt > MAX_WARNING_VALIDITY_MS) return null;
  if (!Array.isArray(warning.regionCodes)) return null;
  const matchedCodes = [...new Set(warning.regionCodes.filter(code => isValidRegionCode(code, regionCodes)))];
  if (matchedCodes.length === 0) return null;
  return {
    id: warning.id,
    source: warning.source,
    title: warning.title.trim().slice(0, 100),
    body: getWarningBody(warning.body),
    url: sourceUrl.href,
    regionCodes: matchedCodes,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export class JsonSubscriptionStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
    this.subscriptions = null;
    this.lock = Promise.resolve();
  }

  async exclusive(operation) {
    const previous = this.lock;
    let release;
    this.lock = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(saved)) throw new Error('Invalid subscription store');
      const now = this.now();
      this.subscriptions = saved.filter(item => item && typeof item.id === 'string' && Number.isFinite(item.createdAt) && now >= item.createdAt && now - item.createdAt < this.ttlMs);
      if (this.subscriptions.length !== saved.length) await this.save();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.subscriptions = [];
    }
    return this.subscriptions;
  }

  async save() {
    const temporaryPath = this.filePath + '.' + randomUUID() + '.tmp';
    await writeFile(temporaryPath, JSON.stringify(this.subscriptions), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  async add(subscription, regionCodes, preferences = {}) {
    const normalized = validateSubscription(subscription);
    const codes = [...new Set(regionCodes)];
    if (codes.length < 1 || codes.length > 10 || codes.some(code => typeof code !== 'string')) throw new HttpError(400, 'Choose between 1 and 10 regions');
    const quietHours = preferences.quietHours ?? null;
    if (quietHours !== null && (!quietHours || !/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHours.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHours.end) || typeof quietHours.timeZone !== 'string')) {
      throw new HttpError(400, 'Invalid quiet-hours preferences');
    }
    if (quietHours !== null) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: quietHours.timeZone });
      } catch {
        throw new HttpError(400, 'Invalid quiet-hours time zone');
      }
    }
    const id = createHash('sha256').update(normalized.endpoint).digest('hex');
    return this.exclusive(async () => {
      await this.load();
      if (this.subscriptions.length >= MAX_SUBSCRIPTIONS) throw new HttpError(503, 'Subscription capacity reached');
      let sanitizedQuietHours = null;
      if (quietHours) sanitizedQuietHours = { start: quietHours.start, end: quietHours.end, timeZone: quietHours.timeZone };
      const record = { id, subscription: normalized, regionCodes: codes, quietHours: sanitizedQuietHours, createdAt: this.now() };
      this.subscriptions = this.subscriptions.filter(item => item.id !== id);
      this.subscriptions.push(record);
      await this.save();
      return id;
    });
  }

  async remove(subscription) {
    const normalized = validateSubscription(subscription);
    const id = createHash('sha256').update(normalized.endpoint).digest('hex');
    await this.exclusive(async () => {
      await this.load();
      const initialCount = this.subscriptions.length;
      this.subscriptions = this.subscriptions.filter(item => item.id !== id);
      if (this.subscriptions.length !== initialCount) await this.save();
    });
  }

  async matching(regionCodes) {
    return this.exclusive(async () => {
      await this.load();
      return this.subscriptions.filter(record => record.regionCodes.some(code => regionCodes.includes(code)));
    });
  }

  async has(id) {
    return this.exclusive(async () => {
      await this.load();
      return this.subscriptions.some(record => record.id === id);
    });
  }
}

function inQuietHours(quietHours, now) {
  if (!quietHours) return false;
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: quietHours.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const current = Number(local.slice(0, 2)) * 60 + Number(local.slice(3, 5));
  const start = Number(quietHours.start.slice(0, 2)) * 60 + Number(quietHours.start.slice(3, 5));
  const end = Number(quietHours.end.slice(0, 2)) * 60 + Number(quietHours.end.slice(3, 5));
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function createDispatcher({ store, deliver, regionCodes, now = Date.now, maxPerHour = 3 }) {
  const sends = new Map();
  const delivered = new Map();
  let queue = Promise.resolve();

  async function deliverWarning(warningInput) {
    const warning = normalizeWarning(warningInput, regionCodes, now());
    if (!warning) throw new HttpError(400, 'Warning is invalid, stale, unsupported, or has no matched region');
    for (const [key, state] of delivered) if (state.expiresAt <= now()) delivered.delete(key);
    const key = warning.source + ':' + warning.id;
    let state = delivered.get(key);
    if (!state) {
      state = { expiresAt: Date.parse(warning.expiresAt), recipients: new Set() };
      delivered.set(key, state);
    }
    const subscriptions = await store.matching(warning.regionCodes);
    if (subscriptions.length > 0 && subscriptions.every(record => state.recipients.has(record.id))) return { sent: 0, skipped: 0, duplicate: true };
    let sent = 0;
    let skipped = 0;
    for (const record of subscriptions) {
      const ttl = Math.min(3600, Math.floor((Date.parse(warning.expiresAt) - now()) / 1000));
      if (ttl <= 0 || state.recipients.has(record.id) || !(await store.has(record.id)) || inQuietHours(record.quietHours, now())) {
        skipped += 1;
        continue;
      }
      const recent = (sends.get(record.id) ?? []).filter(timestamp => now() - timestamp < 3600000);
      if (recent.length >= maxPerHour) { skipped += 1; continue; }
      // Reserve an attempt before awaiting the provider. Failed attempts still consume budget.
      recent.push(now());
      sends.set(record.id, recent);
      try {
        await deliver(record.subscription, { title: warning.title, body: warning.body, url: warning.url, source: warning.source, id: warning.id, expiresAt: warning.expiresAt }, { TTL: ttl });
        state.recipients.add(record.id);
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) await store.remove(record.subscription);
        else throw error;
      }
    }
    if (delivered.size > 10000) delivered.delete(delivered.keys().next().value);
    if (sends.size > MAX_SUBSCRIPTIONS) sends.delete(sends.keys().next().value);
    return { sent, skipped, duplicate: false };
  }

  return async warningInput => {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await deliverWarning(warningInput); }
    finally { release(); }
  };
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function send(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(payload));
}

export function createServerHandler({ origin, subscriberToken, adminToken, regionCodes, store, dispatch }) {
  if (!origin || !subscriberToken || !adminToken || !regionCodes || !store || !dispatch) throw new Error('Push service configuration is incomplete');
  return async (request, response) => {
    try {
      const requestOrigin = request.headers.origin;
      if (requestOrigin && requestOrigin !== origin) throw new HttpError(403, 'Origin not allowed');
      if (requestOrigin) response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'access-control-allow-methods': 'POST, DELETE, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600' });
        response.end();
        return;
      }
      const url = new URL(request.url, origin);
      if (url.pathname === '/health' && request.method === 'GET') return send(response, 200, { status: 'ok' });
      if (url.pathname === '/subscriptions' && request.method === 'POST') {
        if (!isAuthorized(request.headers.authorization, subscriberToken)) throw new HttpError(401, 'Unauthorized');
        const body = await readBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request');
        if (body.consent !== true) throw new HttpError(400, 'Explicit consent is required');
        if (!Array.isArray(body.regionCodes) || body.regionCodes.some(code => !regionCodes.has(code))) throw new HttpError(400, 'Unknown region code');
        const id = await store.add(body.subscription, body.regionCodes, body.preferences);
        return send(response, 201, { id });
      }
      if (url.pathname === '/subscriptions' && request.method === 'DELETE') {
        if (!isAuthorized(request.headers.authorization, subscriberToken)) throw new HttpError(401, 'Unauthorized');
        const body = await readBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request');
        await store.remove(body.subscription);
        return send(response, 204, {});
      }
      if (url.pathname === '/dispatch' && request.method === 'POST') {
        if (!isAuthorized(request.headers.authorization, adminToken)) throw new HttpError(401, 'Unauthorized');
        const body = await readBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request');
        const result = await dispatch(body.warning);
        return send(response, 200, result);
      }
      throw new HttpError(404, 'Not found');
    } catch (error) {
      let status = 500;
      let message = 'Internal server error';
      if (error instanceof HttpError) {
        status = error.status;
        message = error.message;
      }
      return send(response, status, { error: message });
    }
  };
}

export async function loadRegionCodes(path) {
  const payload = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(payload.regions)) throw new Error('Region file must contain a regions array');
  return new Set(payload.regions.map(region => region.code).filter(code => typeof code === 'string'));
}

export async function assertStoreDirectory(filePath) {
  await import('node:fs/promises').then(fs => fs.mkdir(dirname(filePath), { recursive: true, mode: 0o700 }));
}
