import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { cleanupRateLimits, D1RateLimiter } from '../../cloudflare/rate-limit.ts';

function createDatabase(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('cloudflare/migrations/0006_request_rate_limits.sql', 'utf8'));
  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...bound: unknown[]) { return statement(sql, bound); },
      async first<T>() { return sqlite.prepare(sql).get(...(values as never[])) as T | undefined ?? null; },
      async run() {
        const result = sqlite.prepare(sql).run(...(values as never[]));
        return { meta: { changes: Number(result.changes) } };
      }
    };
  }
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

test('fixed-window requests stop at the configured quota', async () => {
  const db = createDatabase();
  const limiter = new D1RateLimiter(db, 'archive', 2, 60, () => 125_000);
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: true });
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: true });
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: false });
  assert.deepEqual(await limiter.limit({ key: 'another-ip-hash' }), { success: true });
});

test('concurrent requests atomically consume only the remaining quota', async () => {
  const db = createDatabase();
  const limiter = new D1RateLimiter(db, 'per-ip', 10, 60, () => 181_000);
  const results = await Promise.all(Array.from({ length: 25 }, () => limiter.limit({ key: 'shared-key' })));
  assert.equal(results.filter(result => result.success).length, 10);
  assert.equal(results.filter(result => !result.success).length, 15);
});

test('a new fixed window resets quota at its exact boundary', async () => {
  const db = createDatabase();
  let now = 59_999;
  const limiter = new D1RateLimiter(db, 'per-ip', 1, 60, () => now);
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: true });
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: false });
  now = 60_000;
  assert.deepEqual(await limiter.limit({ key: 'ip-hash' }), { success: true });
});

test('one global budget key is shared by every caller in the namespace', async () => {
  const db = createDatabase();
  const first = new D1RateLimiter(db, 'global-downloads', 3, 60, () => 121_000);
  const second = new D1RateLimiter(db, 'global-downloads', 3, 60, () => 121_000);
  assert.deepEqual(await first.limit({ key: 'archive-downloads' }), { success: true });
  assert.deepEqual(await second.limit({ key: 'archive-downloads' }), { success: true });
  assert.deepEqual(await first.limit({ key: 'archive-downloads' }), { success: true });
  assert.deepEqual(await second.limit({ key: 'archive-downloads' }), { success: false });
});

test('cleanup removes expired windows but keeps active ones', async () => {
  const db = createDatabase();
  const oldLimiter = new D1RateLimiter(db, 'cleanup', 1, 10, () => 5_000);
  const activeLimiter = new D1RateLimiter(db, 'cleanup', 1, 10, () => 15_000);
  await oldLimiter.limit({ key: 'old' });
  await activeLimiter.limit({ key: 'active' });
  assert.equal(await cleanupRateLimits(db, 19_999), 1);
  const active = await db.prepare('SELECT requests FROM request_rate_limits WHERE key = ?').bind('active').first<{ requests: number }>();
  assert.equal(active?.requests, 1);
});

test('rejects unsafe limiter configuration, keys, and clock values', async () => {
  const db = createDatabase();
  const validNow = () => 1_000;
  for (const [namespace, limit, period] of [
    ['', 1, 60], ['not safe!', 1, 60], ['x'.repeat(65), 1, 60],
    ['ok', 0, 60], ['ok', 1.5, 60], ['ok', 100_001, 60],
    ['ok', 1, 0], ['ok', 1, 86_401], ['ok', 1, 1.5]
  ] as Array<[string, number, number]>) {
    assert.throws(() => new D1RateLimiter(db, namespace, limit, period, validNow));
  }
  const invalidClock = new D1RateLimiter(db, 'clock', 1, 60, () => Number.NaN);
  await assert.rejects(invalidClock.limit({ key: 'key' }), /clock/);
  const limiter = new D1RateLimiter(db, 'key-check', 1, 60, validNow);
  await assert.rejects(limiter.limit({ key: '' }), /key/);
  await assert.rejects(limiter.limit({ key: 'x'.repeat(257) }), /key/);
  const injectionLikeKey = "value'); DROP TABLE request_rate_limits;--";
  assert.deepEqual(await limiter.limit({ key: injectionLikeKey }), { success: true });
  const count = await db.prepare('SELECT COUNT(*) AS count FROM request_rate_limits').first<{ count: number }>();
  assert.equal(count?.count, 1);
  const stored = await db.prepare('SELECT key FROM request_rate_limits WHERE key = ?').bind(injectionLikeKey).first<{ key: string }>();
  assert.equal(stored?.key, injectionLikeKey);
});

test('cleanup rejects invalid time and propagates database errors', async () => {
  const db = createDatabase();
  await assert.rejects(cleanupRateLimits(db, -1), /cleanup time/);
  const broken = { prepare() { throw new Error('database unavailable'); } } as unknown as D1Database;
  const limiter = new D1RateLimiter(broken, 'fail-closed', 1, 60, () => 1_000);
  await assert.rejects(limiter.limit({ key: 'key' }), /database unavailable/);
  await assert.rejects(cleanupRateLimits(broken, 1_000), /database unavailable/);
});
