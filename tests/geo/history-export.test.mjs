import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MAX_YEAR } from '../../src/lib/data/history.ts';
import { MODERN_MILESTONES } from '../../src/lib/data/history-modern.ts';
import { buildHistoryExport } from '../../src/lib/export/history-export.ts';
import { exportFileName, serializeDataset } from '../../src/lib/export/map-export.ts';

const legacyTerritories = JSON.parse(readFileSync(new URL('../../static/data/history-territories.geojson', import.meta.url)));
const modernTerritories = JSON.parse(readFileSync(new URL('../../static/data/history-modern-source.geojson', import.meta.url)));
const territories = { type: 'FeatureCollection', features: [...legacyTerritories.features, ...modernTerritories.features] };
const milestoneCount = HISTORY_EVENTS.filter(event => event.year < 1945).length + MODERN_MILESTONES.length;
const inventory = JSON.parse(readFileSync(new URL('../../static/data/history-inventory.geojson', import.meta.url)));
const dataset = buildHistoryExport({ territories, generatedAt: '2026-11-01T12:00:00.000Z', inventory });

for (const format of ['json', 'geojson']) {
  test(`${format} retains one nested feature per polity and separate milestones and territories`, () => {
    const document = JSON.parse(serializeDataset(dataset, format).content);
    assert.equal(document.type, 'FeatureCollection');
    assert.equal(document.features.length, HISTORICAL_POLITIES.length);
    assert.equal(document.milestones.length, milestoneCount);
    assert.equal(document.discovery_inventory.features.length, 827);
    assert.equal(document.discovery_inventory.metadata.license, 'CC-BY-SA-4.0');
    assert.equal(document.territories.features.length, territories.features.length);
    const majapahit = document.features.find(feature => feature.id === 'majapahit');
    assert.equal(majapahit.geometry, null);
    assert.ok(Array.isArray(majapahit.properties.rulers));
    assert.ok(majapahit.properties.rulers.some(ruler => ruler.name === 'Hayam Wuruk'));
    assert.ok(majapahit.properties.sources.every(source => source.url.startsWith('https://')));
    for (const feature of document.features) {
      for (const location of feature.properties.locations) {
        assert.equal(location.geometry.type, 'Point');
        assert.equal(location.geometry.coordinates.length, 2);
        assert.ok(location.properties.from <= location.properties.to);
      }
      for (const id of feature.properties.territory_ids) {
        assert.equal(document.territories.features.find(territory => territory.id === id).properties.polity_id, feature.id);
      }
    }
    assert.ok(document.metadata.geometry_note.includes('not borders'));
  });
}

test('CSV contains polity records only with a stable, non-sparse schema', () => {
  assert.equal(dataset.rows.length, HISTORICAL_POLITIES.length);
  for (const row of dataset.rows) {
    assert.equal(typeof row.id, 'string');
    assert.ok(Array.isArray(JSON.parse(row.rulers)));
    assert.equal(Object.keys(row).length, dataset.columns.length);
  }
  const indonesia = dataset.rows.find(row => row.id === 'indonesia');
  assert.equal(JSON.parse(indonesia.period).ongoing, true);
  assert.equal(JSON.parse(indonesia.period).display_cutoff, HISTORY_MAX_YEAR);
  assert.ok(!serializeDataset(dataset, 'csv').content.includes('record_type'));
});

test('structured XML preserves arrays and independent milestones instead of JSON strings', () => {
  const xml = serializeDataset(dataset, 'xml').content;
  const parsed = new XMLParser().parse(xml).dataset;
  assert.equal(parsed.type, 'FeatureCollection');
  assert.equal(parsed.features.item.length, HISTORICAL_POLITIES.length);
  assert.equal(parsed.milestones.item.length, milestoneCount);
  assert.equal(parsed.territories.features.item.length, territories.features.length);
  assert.ok(xml.includes('<rulers>'));
  assert.ok(!xml.includes('[{&quot;name&quot;'));
});

test('snapshot GeoJSON exposes correctly dated standard GIS geometry, not a timeless frontier', () => {
  const rendered = JSON.parse(readFileSync(new URL('../../static/data/history-territories-render.geojson', import.meta.url)));
  const snapshot = buildHistoryExport({ territories, renderedTerritories: rendered, year: 1350 });
  const document = JSON.parse(serializeDataset(snapshot, 'geojson').content);
  assert.equal(document.metadata.snapshot_year, 1350);
  const majapahit = document.features.find(feature => feature.id === 'majapahit');
  const expected = rendered.features.find(feature => feature.properties.id === 'majapahit' && feature.properties.from <= 1350 && 1350 <= feature.properties.to);
  assert.deepEqual(majapahit.geometry, expected.geometry);
  const row = snapshot.rows.find(row => row.id === 'majapahit');
  assert.deepEqual(JSON.parse(row.geometry_context), majapahit.properties.geometry_context);
  assert.deepEqual(JSON.parse(row.geometry_provenance).source_metadata, rendered.metadata);
  assert.equal(majapahit.properties.geometry_context.role, 'dated_reconstruction_clipped_to_display_mask');
  assert.ok(majapahit.properties.geometry_context.valid_from <= 1350 && 1350 <= majapahit.properties.geometry_context.valid_to);
  for (const id of majapahit.properties.geometry_context.source_territory_ids) {
    const original = document.territories.features.find(feature => feature.id === id);
    assert.ok(original && original.properties.from <= 1350 && 1350 <= original.properties.to);
    assert.ok(majapahit.properties.territory_ids.includes(id));
  }
  const inactive = document.features.find(feature => feature.id === 'dutch-east-indies');
  assert.equal(inactive.geometry, null);
  assert.equal(inactive.properties.geometry_context.role, 'inactive_in_snapshot_year');
});

test('snapshot identities survive source reordering and match the rendered archive', () => {
  const reversed = buildHistoryExport({ territories: { ...territories, features: [...territories.features].reverse() } });
  assert.deepEqual(new Set(reversed.document.territories.features.map(feature => feature.id)), new Set(dataset.document.territories.features.map(feature => feature.id)));
  const rendered = JSON.parse(readFileSync(new URL('../../static/data/history-territories-render.geojson', import.meta.url)));
  const originalIds = new Set(dataset.document.territories.features.map(feature => feature.id));
  const referenceIds = new Set(rendered.reference_geometries.features.map(feature => feature.id));
  assert.ok(rendered.features.every(feature => {
    if (feature.properties.reference_id) return referenceIds.has(feature.properties.reference_id);
    return originalIds.has(feature.properties.source_snapshot_id ?? feature.id);
  }));
});

test('ambiguous simultaneous reconstructions retain separate source IDs without inventing a union', () => {
  const original = territories.features.find(feature => feature.properties.id === 'majapahit' && feature.properties.from <= 1350 && 1350 <= feature.properties.to);
  const alternative = structuredClone(original);
  alternative.properties.sourceName = 'Alternative reconstruction';
  const ambiguous = buildHistoryExport({ territories: { ...territories, features: [...territories.features, alternative] }, year: 1350 });
  const polity = ambiguous.document.features.find(feature => feature.id === 'majapahit');
  assert.equal(polity.geometry, null);
  assert.equal(polity.properties.geometry_context.role, 'ambiguous_multiple_source_snapshots');
  assert.equal(polity.properties.geometry_context.source_territory_ids.length, 2);
  assert.throws(() => buildHistoryExport({ territories: { ...territories, features: [...territories.features, original] } }), /snapshot identity collision/);
});

test('point-only snapshots use dated reference locations without claiming a capital or border', () => {
  const before = buildHistoryExport({ territories, year: 1855 }).document.features.find(feature => feature.id === 'tanjungpura');
  const after = buildHistoryExport({ territories, year: 1856 }).document.features.find(feature => feature.id === 'tanjungpura');
  assert.equal(before.geometry.type, 'Point');
  assert.equal(after.geometry.type, 'Point');
  assert.notDeepEqual(before.geometry.coordinates, after.geometry.coordinates);
  assert.equal(after.properties.geometry_context.role, 'approximate_reference_point_not_capital_or_boundary');
  assert.equal(after.properties.geometry_context.valid_from, 1856);
});

for (const year of [NaN, 1.5, -401, HISTORY_MAX_YEAR + 1]) {
  test(`invalid export snapshot year ${year} is rejected`, () => {
    assert.throws(() => buildHistoryExport({ territories, year }), /Invalid historical export snapshot year/);
  });
}

test('GeoJSON has the correct extension and MIME and is rejected for non-geographical datasets', () => {
  assert.equal(exportFileName(dataset, 'geojson'), 'nusantara-history-nusantara-historical-catalogue-20261101.geojson');
  assert.equal(serializeDataset(dataset, 'geojson').mimeType, 'application/geo+json');
  assert.throws(() => serializeDataset({ ...dataset, document: undefined }, 'geojson'), /GeoJSON unavailable/);
});
