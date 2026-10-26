import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDispatcher, HttpError, isAuthorized, JsonSubscriptionStore, normalizeWarning } from '../../server/push-service.mjs';

const regions = new Set(['32', '33']);
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-token',
  keys: { p256dh: 'A'.repeat(30), auth: 'B'.repeat(20) }
};
const warning = {
  id: 'BMKG-123', source: 'BMKG', title: 'Weather alert', body: 'Heavy rain',
  url: 'https://www.bmkg.go.id/peringatan/cuaca', regionCodes: ['32', '999'],
  issuedAt: '2025-01-01T00:00:00.000Z', expiresAt: '2025-01-01T02:00:00.000Z'
};

async function temporaryStore(t, now) {
  const directory = await mkdtemp(join(tmpdir(), 'nusantara-push-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return new JsonSubscriptionStore(join(directory, 'subscriptions.json'), { now });
}

test('authorization uses distinct, constant-time bearer token comparison', () => {
  assert.equal(isAuthorized('Bearer ' + 'x'.repeat(32), 'x'.repeat(32)), true);
  assert.equal(isAuthorized('Bearer short', 'short'), false);
  assert.equal(isAuthorized('Bearer ' + 'x'.repeat(32), 'y'.repeat(32)), false);
});

test('warning validation rejects stale, mismatched publishers and unsafe URLs', () => {
  const codes = new Set(['32']);
  assert.equal(normalizeWarning(warning, codes, Date.parse('2025-01-01T01:00:00Z')).regionCodes[0], '32');
  assert.equal(normalizeWarning({ ...warning, source: 'BNPB' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning(warning, codes, Date.parse('2025-01-02T00:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, source: 'NASA' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, url: 'https://example.com' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, url: 'https://other.go.id/warning' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, url: 'https://www.bmkg.go.id:8443/warning' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, url: 'https://user:pass@www.bmkg.go.id/warning' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, expiresAt: '2025-01-03T00:00:00.000Z' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, issuedAt: 'January 1 2025' }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
  assert.equal(normalizeWarning({ ...warning, regionCodes: ['999'] }, codes, Date.parse('2025-01-01T01:00:00Z')), null);
});

test('subscriptions require explicit privacy-minimal data and persist revocation', async t => {
  let now = 1000;
  const store = await temporaryStore(t, () => now);
  await assert.rejects(store.add({ endpoint: 'https://127.0.0.1/path', keys: subscription.keys }, ['32']), HttpError);
  await assert.rejects(store.add(subscription, ['32'], { quietHours: { start: '25:00', end: '07:00', timeZone: 'UTC' } }), HttpError);
  const id = await store.add(subscription, ['32']);
  assert.equal((await store.matching(['32'])).length, 1);
  assert.equal((await new JsonSubscriptionStore(store.filePath, { now: () => now }).matching(['32'])).length, 1);
  await store.remove(subscription);
  assert.equal((await store.matching(['32'])).length, 0);
  await store.add(subscription, ['32']);
  now += 31 * 24 * 60 * 60 * 1000;
  assert.equal((await store.matching(['32'])).length, 0);
  assert.equal((await new JsonSubscriptionStore(store.filePath, { now: () => now }).matching(['32'])).length, 0);
  assert.equal(typeof id, 'string');
});

test('dispatcher matches exact regions, honors dedup and rate limits, and keeps source link', async t => {
  let now = Date.parse('2025-01-01T01:00:00Z');
  const store = await temporaryStore(t, () => now);
  await store.add(subscription, ['32']);
  const delivered = [];
  const dispatch = createDispatcher({ store, regionCodes: regions, now: () => now, maxPerHour: 1, deliver: async (sub, payload) => delivered.push(payload) });
  const first = await dispatch(warning);
  assert.equal(first.sent, 1);
  assert.equal(delivered[0].url, warning.url);
  assert.deepEqual(await dispatch(warning), { sent: 0, skipped: 0, duplicate: true });
  const second = await dispatch({ ...warning, id: 'BMKG-124' });
  assert.equal(second.skipped, 1);
  assert.equal(delivered.length, 1);
});

test('concurrent dispatches serialize deduplication and per-subscription rate limits', async t => {
  let now = Date.parse('2025-01-01T01:00:00Z');
  const store = await temporaryStore(t, () => now);
  await store.add(subscription, ['32']);
  let deliveries = 0;
  const dispatch = createDispatcher({ store, regionCodes: regions, now: () => now, deliver: async () => { deliveries += 1; await new Promise(resolve => setTimeout(resolve, 5)); } });
  const [first, second] = await Promise.all([dispatch(warning), dispatch(warning)]);
  assert.equal(deliveries, 1);
  assert.equal([first, second].filter(result => result.duplicate).length, 1);
  const [third, fourth] = await Promise.all([dispatch({ ...warning, id: 'BMKG-124' }), dispatch({ ...warning, id: 'BMKG-125' })]);
  assert.equal(deliveries, 3);
  assert.equal(third.sent + fourth.sent, 2);
});

test('concurrent registrations on one store persist without losing writes', async t => {
  const store = await temporaryStore(t, Date.now);
  const registrations = Array.from({ length: 8 }, (_, index) => store.add({ ...subscription, endpoint: subscription.endpoint + index }, ['32']));
  await Promise.all(registrations);
  assert.equal((await store.matching(['32'])).length, 8);
  assert.equal((await new JsonSubscriptionStore(store.filePath).matching(['32'])).length, 8);
});

test('dispatcher rejects unsupported or expired warnings without delivering', async t => {
  const now = Date.parse('2025-01-01T01:00:00Z');
  const store = await temporaryStore(t, () => now);
  const dispatch = createDispatcher({ store, regionCodes: regions, now: () => now, deliver: async () => assert.fail('must not deliver') });
  await assert.rejects(dispatch({ ...warning, source: 'Other' }), HttpError);
});
