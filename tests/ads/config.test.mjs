import test from 'node:test';
import assert from 'node:assert/strict';
import { adsConfig, validateAdsConfiguration } from '../../src/lib/ads/config.ts';

const valid = {
  enabled: true,
  client: 'ca-pub-5501931731194817',
  testMode: false,
  placements: { home: '5292790825' },
  frameOrigins: ['https://googleads.g.doubleclick.net', 'https://tpc.googlesyndication.com', 'https://*.safeframe.googlesyndication.com', 'https://ep2.adtrafficquality.google', 'https://www.google.com']
};

test('loads the operator-approved homepage slot in live mode and requires a boolean test flag', () => {
  assert.deepEqual(adsConfig, valid);
  assert.equal(validateAdsConfiguration({ ...valid, testMode: true })?.testMode, true);
  assert.equal(validateAdsConfiguration({ ...valid, testMode: 'false' }), undefined);
  assert.equal(validateAdsConfiguration({ ...valid, enabled: false }), undefined);
});

test('rejects malformed publisher IDs, slot IDs, and unsafe frame origins', () => {
  assert.equal(validateAdsConfiguration({ ...valid, client: 'https://evil.example/script' }), undefined);
  assert.equal(validateAdsConfiguration({ ...valid, placements: { ...valid.placements, home: '123<script>' } }), undefined);
  assert.equal(validateAdsConfiguration({ ...valid, frameOrigins: ['javascript:alert(1)'] }), undefined);
  assert.equal(validateAdsConfiguration(null), undefined);
});
