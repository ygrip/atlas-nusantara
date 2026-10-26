import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCollection, validateProvenance, CODE_EDITION } from '../../scripts/geo/build-geometry.mjs';

const provenance = { boundaryEdition: 'reviewed fixture', codeEdition: CODE_EDITION, source: 'https://example.org/data', license: 'CC-BY-4.0', licenseUrl: 'https://example.org/license', reviewedBy: 'Fixture reviewer', reviewedAt: '2026-01-01' };
test('requires explicit license, source and independent code and boundary editions', () => {
  assert.doesNotThrow(() => validateProvenance(provenance));
  for (const change of [{ license: 'unknown' }, { codeEdition: '2025' }, { reviewedBy: '' }, { source: 'http://example.org' }]) {
    assert.throws(() => validateProvenance({ ...provenance, ...change }));
  }
});
const feature = { type: 'Feature', properties: { code: '11' }, geometry: { type: 'Polygon', coordinates: [[[95, 1], [96, 1], [96, 2], [95, 1]]] } };
test('rejects incomplete, duplicate, numeric and unmatched code joins', () => {
  for (const features of [[], [feature, feature], [{ ...feature, properties: { code: 11 } }], [{ ...feature, properties: { code: '99' } }]]) {
    assert.throws(() => validateCollection({ type: 'FeatureCollection', features }, new Set(['11']), 'test'));
  }
  assert.doesNotThrow(() => validateCollection({ type: 'FeatureCollection', features: [feature] }, new Set(['11']), 'test'));
});
