import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curatedPolityFor } from '../../src/lib/data/history-catalogue.ts';
import { HISTORICAL_POLITIES } from '../../src/lib/data/history.ts';
import { buildHistoryExport } from '../../src/lib/export/history-export.ts';
import { serializeDataset } from '../../src/lib/export/map-export.ts';

const load = name => JSON.parse(readFileSync(new URL(`../../static/data/${name}`, import.meta.url)));
const research = load('history-research.geojson');
const inventory = load('history-inventory.geojson');
const territories = load('history-territories.geojson');
const rendered = load('history-territories-render.geojson');

test('every inventory occurrence has a traceable research dossier without invented dates or geometry', () => {
  const ids = new Set(research.features.map(feature => feature.id));
  assert.equal(ids.size, research.features.length);
  assert.equal(research.metadata.coverage.entries, inventory.features.length);
  for (const feature of inventory.features) assert.ok(ids.has(feature.id), feature.properties.name);
  for (const dossier of research.features) {
    assert.equal(dossier.geometry, null);
    assert.equal(dossier.properties.period, null);
    assert.ok(dossier.properties.source_url.startsWith('https://'));
    for (const article of dossier.properties.articles) {
      assert.ok(Number.isInteger(article.revision));
      assert.ok(article.url.includes(`oldid=${article.revision}`));
      assert.equal(article.license, 'CC-BY-SA-4.0');
    }
    for (const reference of dossier.properties.genealogy_sections) {
      assert.ok(reference.from_pdf_page <= reference.to_pdf_page);
      assert.ok(research.genealogy_sections.some(section => section.name === reference.name));
    }
  }
});

test('genealogy sources retain all 365 body pages with explicit reuse rights and local book text stays private', () => {
  const pages = research.genealogy_sections.flatMap(section => section.pages.map(page => page.pdf_page));
  assert.equal(pages.length, 365);
  assert.equal(new Set(pages).size, 365);
  assert.equal(Math.min(...pages), 8);
  assert.equal(Math.max(...pages), 372);
  assert.equal(research.metadata.genealogy_source.license, 'CC-BY-4.0');
  assert.equal(research.metadata.local_book_sources.length, 5);
  const serialized = JSON.stringify(research);
  assert.ok(!serialized.includes('/Users/'));
  assert.ok(!serialized.includes('cache_path'));
});

test('full export preserves all source dossiers but keeps unknown dates out of the playable catalogue', () => {
  const additional = research.features.filter(dossier => !curatedPolityFor(dossier));
  const dataset = buildHistoryExport({ territories, generatedAt: '2026-11-01T12:00:00Z', inventory, research, renderedTerritories: rendered });
  const document = JSON.parse(serializeDataset(dataset, 'geojson').content);
  assert.equal(document.features.length, HISTORICAL_POLITIES.length + additional.length);
  assert.equal(dataset.rows.length, document.features.length);
  assert.equal(document.research_sources.features.length, research.features.length);
  assert.equal(document.rendered_territories.features.length, rendered.features.length);
  assert.ok(serializeDataset(dataset, 'xml').content.includes('<rendered_territories>'));
  for (const dossier of additional) {
    const row = dataset.rows.find(row => row.id === dossier.id);
    assert.equal(row.from, null);
    assert.equal(row.to, null);
    const dossiers = JSON.parse(row.research_dossier);
    assert.equal(dossiers.length, 1);
    assert.ok(dossiers[0].review_status.includes('review') || dossiers[0].review_status === 'list_source_only');
  }
  for (const row of dataset.rows) {
    assert.ok(Array.isArray(JSON.parse(row.research_dossier)));
    assert.ok(Array.isArray(JSON.parse(row.research_dossier_ids)));
  }
  const dossierIds = new Set(research.features.map(dossier => dossier.id));
  for (const feature of document.features) {
    assert.ok(feature.properties.research_dossier_ids.every(id => dossierIds.has(id)));
  }
  assert.ok(!serializeDataset(dataset, 'csv').content.includes('record_type'));
});
