import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeShareUrl, makeDestinationShareUrl, isPublicDestinationId, isPublicRegionCode, validShareSummary, validGeometryInput, geometryForShare, summaryForShare } from '../../src/lib/share/card.ts';

const counts = { warning: 1, earthquake: 2, incident: 3, hazard: 4 };

test('share links use the fixed public origin and accept only public region codes', () => {
  assert.equal(makeShareUrl(), 'https://nusantara.readynaz.com/');
  assert.equal(makeShareUrl({ code: '32.01', name: 'Example' }), 'https://nusantara.readynaz.com/?region=32.01');
  assert.equal(makeShareUrl({ code: '32.01&next=https://evil.test', name: 'Example' }), 'https://nusantara.readynaz.com/');
  assert.equal(isPublicRegionCode('32'), true);
  assert.equal(isPublicRegionCode('32.01'), true);
  assert.equal(isPublicRegionCode('32.1'), false);
});

test('geometry is shown only when it carries bounded, valid SVG path inputs', () => {
  const geometry = {
    schemaVersion: 1,
    source: 'Boundary dataset',
    codeEdition: '2022',
    license: 'CC-BY-4.0',
    boundaryEdition: '2022',
    level: 'province',
    viewBox: '0 0 1000 500',
    regions: [{ id: '32', name: 'West Java', level: 'province', parentId: null, sourceCode: '32', source: 'Boundary dataset', boundaryEdition: '2022', path: 'M0 0 L10 0 L10 10 Z', bbox: [0, 0, 10, 10] }]
  };
  assert.equal(validGeometryInput(geometry), geometry);
  assert.equal(validGeometryInput({ ...geometry, license: '' }), undefined);
  assert.equal(validGeometryInput({ ...geometry, regions: [{ ...geometry.regions[0], path: '<script>' }] }), undefined);
});

test('share summary must contain a valid timestamp, safe integer counts and text sources', () => {
  const valid = { generatedAt: '2026-01-01T00:00:00Z', counts, sourceNames: ['BMKG'] };
  assert.equal(validShareSummary(valid), true);
  assert.equal(validShareSummary({ ...valid, generatedAt: 'yesterday' }), false);
  assert.equal(validShareSummary({ ...valid, counts: { ...counts, warning: -1 } }), false);
  assert.equal(validShareSummary({ ...valid, counts: { ...counts, hazard: Number.MAX_SAFE_INTEGER + 1 } }), false);
  assert.equal(validShareSummary({ ...valid, sourceNames: ['BMKG', 7] }), false);
  assert.equal(validShareSummary(undefined), false);
  assert.equal(validShareSummary({ ...valid, sourceNames: [] }), false);
  assert.equal(summaryForShare(valid), valid);
  assert.equal(summaryForShare({ ...valid, counts: { warning: 0, earthquake: 0, incident: 0, hazard: 0 } }), undefined);
  assert.equal(summaryForShare(valid, { code: '32', name: 'Selected province' }), undefined);
});

test('regional share maps fit only the selected city, never its whole province', () => {
  const first = { id: '32.01', sourceCode: '32.01', name: 'Fixture first', path: 'M0 0 L10 0 L10 10 Z', bbox: [0, 0, 10, 10] };
  const second = { ...first, id: '32.02', sourceCode: '32.02', name: 'Fixture second', bbox: [20, 20, 30, 30] };
  const geometry = { schemaVersion: 1, source: 'https://example.org/fixture', license: 'CC0-1.0', codeEdition: '2022', boundaryEdition: 'SYNTHETIC TEST FIXTURE', viewBox: '0 0 1000 500', regions: [first, second] };
  assert.deepEqual(geometryForShare(geometry, { code: '32.01', name: 'Selected city' }).regions.map(region => region.sourceCode), ['32.01']);
  assert.notEqual(geometryForShare(geometry, { code: '32.01', name: 'Selected city' }).viewBox, geometry.viewBox);
  assert.equal(geometryForShare(geometry, { code: '32', name: 'Province' }).regions.length, 2);
  assert.equal(geometryForShare(geometry, { code: '33.01', name: 'Other city' }), undefined);
});

test('destination links reopen the destinations list and reject unsafe ids', () => {
  assert.equal(
    makeDestinationShareUrl('35', 'sisparnas-77723'),
    'https://nusantara.readynaz.com/?region=35&layer=destinations&destination=sisparnas-77723'
  );
  assert.equal(makeDestinationShareUrl('35', 'x&next=https://evil.test'), 'https://nusantara.readynaz.com/?region=35');
  assert.equal(makeDestinationShareUrl('bad', 'sisparnas-1'), 'https://nusantara.readynaz.com/');
  assert.equal(isPublicDestinationId('commons-1_a'), true);
  assert.equal(isPublicDestinationId('a b'), false);
  assert.equal(isPublicDestinationId(''), false);
});
