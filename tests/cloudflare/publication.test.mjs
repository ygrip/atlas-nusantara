import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPublications, publishHot, serveHot, servePublication, storePublication } from '../../cloudflare/publication.ts';

function databaseStub() {
  const rows = new Map();
  let failBatch = false;
  function prepared(sql, values = []) {
    return {
      sql,
      values,
      bind(...bindings) { return prepared(sql, bindings); },
      async run() { return execute(sql, values); },
      async first() { return rows.get(values[0]) ?? null; }
    };
  }
  function execute(sql, values) {
    if (sql.startsWith('INSERT INTO publications')) {
      const [key, payload_json, generated_at, valid_until] = values;
      const current = rows.get(key);
      if (!current || generated_at > current.generated_at) rows.set(key, { key, payload_json, generated_at, valid_until });
      let changes = 1;
      if (current) changes = Number(generated_at > current.generated_at);
      return { meta: { changes } };
    }
    if (sql.startsWith('DELETE FROM publications')) {
      let changes = 0;
      for (const [key, row] of rows) {
        if (key.startsWith(values[0].slice(0, -1)) && row.valid_until <= values[1]) {
          rows.delete(key);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }
    throw Error('Unexpected SQL: ' + sql);
  }
  return {
    rows,
    failNextBatch() { failBatch = true; },
    prepare(sql) { return prepared(sql); },
    async batch(statements) {
      if (failBatch) { failBatch = false; throw Error('synthetic batch failure'); }
      const original = new Map(rows);
      try {
        return statements.map(statement => execute(statement.sql, statement.values));
      } catch (error) {
        rows.clear();
        for (const [key, value] of original) rows.set(key, value);
        throw error;
      }
    }
  };
}
function snapshot(fetchedAt, validUntil = null) {
  return { schemaVersion: 1, generatedAt: fetchedAt, records: [], provenance: {
    source: 'BMKG', sourceUrl: 'https://example.org/fixture', fetchedAt, sourcePublishedAt: fetchedAt, validUntil,
    license: 'CC0-1.0', licenseUrl: 'https://example.org/fixture-license', reviewedBy: 'Synthetic test', reviewedAt: fetchedAt, coverage: [], edition: null
  } };
}

test('hot publication stores versioned payloads before the manifest in one batch', async () => {
  const db = databaseStub();
  const now = Date.now();
  const result = await publishHot(db, { counts: {} }, { warning: snapshot(new Date(now).toISOString()) }, now);
  const keys = [...db.rows.keys()];
  assert.equal(keys.length, 3);
  assert.equal(keys.at(-1), 'data/published/manifest.json');
  assert.equal(JSON.parse(db.rows.get('data/published/manifest.json').payload_json).revision, result.revision);
  assert.ok(db.rows.has(result.summary.slice(1)));
  assert.ok(db.rows.has(result.snapshots.warning.slice(1)));
});

test('batch failures leave no partial publication and older runs cannot roll back manifest', async () => {
  const db = databaseStub();
  const now = Date.now();
  db.failNextBatch();
  await assert.rejects(publishHot(db, { failed: true }, {}, now), /synthetic batch failure/);
  assert.equal(db.rows.size, 0);
  await publishHot(db, { newer: true }, {}, now + 2000);
  const manifestBefore = db.rows.get('data/published/manifest.json');
  await publishHot(db, { older: true }, {}, now + 1000);
  assert.deepEqual(db.rows.get('data/published/manifest.json'), manifestBefore);
});

test('warning publication expires at CAP expiry and does not extend source freshness', async () => {
  const now = Date.now();
  for (const expiry of [now + 60_000, now + 3_600_000]) {
    const result = await publishHot(databaseStub(), {}, { warning: snapshot(new Date(now).toISOString(), new Date(expiry).toISOString()) }, now);
    assert.equal(Date.parse(result.validUntil), Math.min(expiry, now + 15 * 60_000));
  }
});

test('publication JSON stays within the size budget and fails closed after expiry', async () => {
  const db = databaseStub();
  const now = Date.now();
  await assert.rejects(storePublication(db, 'data/observations/hazards.json', JSON.stringify({ body: 'x'.repeat(2_000_001) }), new Date(now).toISOString(), new Date(now + 60_000).toISOString()), /publication budget/);
  const key = 'data/published/123e4567-e89b-42d3-a456-426614174000/summary.json';
  await storePublication(db, key, '{}', new Date(now - 120_000).toISOString(), new Date(now - 60_000).toISOString());
  const response = await serveHot(new Request('https://nusantara.readynaz.com/' + key), db);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('serves GET and HEAD with bounded cache headers and restricts hot routes', async () => {
  const db = databaseStub();
  const key = 'data/published/123e4567-e89b-42d3-a456-426614174000/summary.json';
  const validUntil = new Date(Date.now() + 60_000).toISOString();
  await storePublication(db, key, '{"ok":true}', new Date().toISOString(), validUntil);
  const get = await serveHot(new Request('https://nusantara.readynaz.com/' + key), db);
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), { ok: true });
  assert.match(get.headers.get('cache-control'), /public, max-age=\d+, must-revalidate/);
  assert.match(get.headers.get('etag'), /^"[0-9a-f]{64}"$/);
  const head = await serveHot(new Request('https://nusantara.readynaz.com/' + key, { method: 'HEAD' }), db);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await serveHot(new Request('https://nusantara.readynaz.com/data/published/../secret'), db)).status, 404);
  assert.equal((await serveHot(new Request('https://nusantara.readynaz.com/' + key, { method: 'POST' }), db)).status, 405);
});

test('hazard publication helper protects newer records and serves its allowlisted key', async () => {
  const db = databaseStub();
  const key = 'data/observations/hazards.json';
  const now = Date.now();
  await storePublication(db, key, '{"version":2}', new Date(now + 1000).toISOString(), new Date(now + 60_000).toISOString());
  await storePublication(db, key, '{"version":1}', new Date(now).toISOString(), new Date(now + 60_000).toISOString());
  const response = await servePublication(new Request('https://nusantara.readynaz.com/data/observations/hazards.json'), db, key);
  assert.deepEqual(await response.json(), { version: 2 });
});

test('cleanup removes only expired versioned publication records', async () => {
  const db = databaseStub();
  const now = Date.now();
  await storePublication(db, 'data/published/old/summary.json', '{}', new Date(now - 20).toISOString(), new Date(now - 10).toISOString());
  await storePublication(db, 'data/published/manifest.json', '{}', new Date(now).toISOString(), new Date(now + 10_000).toISOString());
  await storePublication(db, 'data/observations/hazards.json', '{}', new Date(now - 20).toISOString(), new Date(now - 10).toISOString());
  await cleanPublications(db, now);
  assert.deepEqual([...db.rows.keys()], ['data/published/manifest.json', 'data/observations/hazards.json']);
});
