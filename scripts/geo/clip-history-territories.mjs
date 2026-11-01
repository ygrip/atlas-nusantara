#!/usr/bin/env node
/** Build render-only historical polygons clipped to the exact base-map coastline. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { historicalTerritoryId } from '../../src/lib/map/history-territories.ts';
import { clipHistoricalTerritories, intersectProjectedTerritories } from './history-land-mask.mjs';
import { buildModernHistoryDisplay } from './modern-history-geometry.mjs';

const [inputPath, nationalPath, manifestPath, outputPath, modernPath, contextPath] = process.argv.slice(2);
if (Boolean(modernPath) !== Boolean(contextPath)) throw new Error('Modern source and reference context must be provided together');
if (!inputPath || !nationalPath || !manifestPath || !outputPath) {
  throw new Error('Usage: node --experimental-strip-types scripts/geo/clip-history-territories.mjs source.geojson national.json manifest.json output.geojson');
}
const [sourceBytes, nationalBytes, manifestBytes] = await Promise.all([
  readFile(inputPath), readFile(nationalPath), readFile(manifestPath)
]);
const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
const nationalHash = createHash('sha256').update(nationalBytes).digest('hex');
const territories = JSON.parse(sourceBytes.toString('utf8'));
const national = JSON.parse(nationalBytes.toString('utf8'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const projection = national.projection;
if (!projection || projection.type !== 'mercator') throw Error('National base map has no Mercator projection');

const clipped = await clipHistoricalTerritories(territories, national, projection, intersectProjectedTerritories);
let modern;
let modernMetadata;
if (modernPath && contextPath) {
  const [modernBytes, contextBytes] = await Promise.all([readFile(modernPath), readFile(contextPath)]);
  const modernSource = JSON.parse(modernBytes.toString('utf8'));
  const context = JSON.parse(contextBytes.toString('utf8'));
  modern = buildModernHistoryDisplay(modernSource, national, context, manifest);
  modernMetadata = {
    source: modernPath, source_sha256: createHash('sha256').update(modernBytes).digest('hex'),
    source_feature_count: modernSource.features.length, display_feature_count: modern.features.length,
    context: contextPath, context_sha256: createHash('sha256').update(contextBytes).digest('hex'),
    interpretation: modern.interpretation
  };
}
const baseFeatures = clipped.features.map(feature => ({ ...feature, id: historicalTerritoryId(feature) }));
const allFeatures = [...baseFeatures, ...(modern?.features ?? [])];
const output = {
  type: 'FeatureCollection',
  metadata: {
    source: inputPath, source_sha256: sourceHash,
    historical_source: 'https://github.com/Seshat-Global-History-Databank/cliopatria',
    historical_license: 'CC-BY-4.0', historical_attribution: 'Bennett et al.; Seshat Global History Databank',
    land_mask_source: manifest.source, land_mask_boundary_edition: manifest.boundaryEdition,
    land_mask_license: manifest.license, land_mask_attribution: manifest.attribution,
    land_mask_geometry: nationalPath, land_mask_sha256: nationalHash,
    projection: 'The exact Mercator parameters saved in the national SVG geometry package; clipping performed in its projected plane.',
    interpretation: 'Render geometry only: source historical reconstruction clipped to modern mapped land for coastline alignment. This does not validate historical frontiers or imply sovereignty. Use the untouched source GeoJSON for original research geometry.',
    operation: 'Independent polygon intersection against the union of canonical national SVG land; no simplification, snapping, source repair or modern internal-boundary inference.',
    engine: 'polygon-clipping@0.15.7',
    land_mask_fill_rule: 'Nonzero per province path, then union; identical to base-map SVG and terrain canvas fills.',
    source_feature_count: territories.features.length, clipped_feature_count: clipped.features.length,
    modern: modernMetadata, rendered_feature_count: allFeatures.length
  },
  context_land: modern?.context_land,
  reference_geometries: modern?.reference_geometries,
  features: allFeatures
};
await writeFile(outputPath, JSON.stringify(output));
console.log(`Clipped ${clipped.features.length}/${territories.features.length} legacy features; ${modern?.features.length ?? 0} qualified modern display features; ${allFeatures.length} total.`);
