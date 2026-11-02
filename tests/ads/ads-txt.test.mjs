import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAdsTxt } from '../../scripts/generate-ads-txt.mjs';

test('builds a Google DIRECT ads.txt line from the AdSense client ID', () => {
  assert.equal(buildAdsTxt({ enabled: true, client: 'ca-pub-1234567890123456' }), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
});

test('emits nothing when ads are disabled and rejects a malformed client ID', () => {
  assert.equal(buildAdsTxt({ enabled: false, client: 'ca-pub-1234567890123456' }), '');
  assert.throws(() => buildAdsTxt({ enabled: true, client: 'pub-123' }), /client must look like/);
});

test('committed static/ads.txt matches config/ads.json', async () => {
  const config = JSON.parse(await readFile(new URL('../../config/ads.json', import.meta.url), 'utf8'));
  const committed = await readFile(new URL('../../static/ads.txt', import.meta.url), 'utf8');
  assert.equal(committed, buildAdsTxt(config));
});
