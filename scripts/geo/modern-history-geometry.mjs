import polygonClipping from 'polygon-clipping';
import { nationalLandGeoJson, projectGeometry, inverseGeometry } from './history-land-mask.mjs';
import { historicalTerritoryId } from '../../src/lib/map/history-territories.ts';
import { HISTORY_PRESENT_YEAR, MODERN_STATUS_PHASES, modernTerritorialStatusAt } from '../../src/lib/data/history-modern.ts';

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return geometry.coordinates;
}

function unionFeatures(features) {
  if (features.length === 0) throw new Error('A modern reference mask is empty');
  return polygonClipping.union(...features.map(feature => polygonsOf(feature.geometry)));
}

function regionalStatusIds(year) {
  return ['western-new-guinea', 'timor-leste'].map(region => modernTerritorialStatusAt(region, year)?.id).filter(Boolean);
}

function sourceRenderRole(polityId, year) {
  if (polityId === 'timor-leste') return 'reconstructed_independent_state_not_verified_control';
  if (year >= 1976 && year < 1999) return 'reconstruction_including_unrecognized_occupation';
  return 'reconstructed_administration_not_verified_control';
}

function maskFor(polityId, year, masks) {
  if (polityId === 'timor-leste') return masks.timor;
  let mask = masks.indonesia;
  if (year < 1963) mask = polygonClipping.difference(mask, masks.papua);
  if (year >= 1976 && year < 1999) mask = polygonClipping.union(mask, masks.timor);
  return mask;
}

function splitYears(feature) {
  const from = Math.max(1945, feature.properties.from);
  const to = Math.min(HISTORY_PRESENT_YEAR, feature.properties.to);
  const boundaries = new Set([from, to + 1]);
  for (const phase of MODERN_STATUS_PHASES) {
    if (phase.annualFrom > from && phase.annualFrom <= to) boundaries.add(phase.annualFrom);
  }
  for (const year of [1963, 1976, 1999, 2002]) {
    if (year > from && year <= to) boundaries.add(year);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  return ordered.slice(0, -1).map((year, index) => ({ from: year, to: ordered[index + 1] - 1 }));
}

function reconstructionPieces(feature, masks, projection) {
  const projected = projectGeometry(feature.geometry, projection);
  const sourceId = historicalTerritoryId(feature);
  const pieces = [];
  for (const period of splitYears(feature)) {
    const coordinates = polygonClipping.intersection(polygonsOf(projected), maskFor(feature.properties.id, period.from, masks));
    if (coordinates.length === 0) continue;
    pieces.push({
      type: 'Feature', id: `display:${sourceId}:${period.from}:${period.to}`,
      properties: {
        ...feature.properties, ...period, modern: true,
        source_snapshot_id: sourceId, source_from: feature.properties.from, source_to: feature.properties.to,
        render_role: sourceRenderRole(feature.properties.id, period.from),
        regional_status_ids: regionalStatusIds(period.from)
      },
      geometry: inverseGeometry({ type: 'MultiPolygon', coordinates }, projection)
    });
  }
  return pieces;
}

function referenceDisplay(polityId, from, to, reference, role, ongoing = false) {
  return {
    type: 'Feature', id: `display:${reference.id}:${from}:${to}:${role}`,
    properties: {
      id: polityId, from, to, sourceName: reference.properties.name,
      modern: true, reference_id: reference.id, reference_ongoing: ongoing,
      render_role: role, regional_status_ids: regionalStatusIds(from)
    },
    geometry: reference.geometry
  };
}

/**
 * Keep original Cliopatria frames untouched. Derive explicit annual display pieces
 * instead of misreading the 1960–75/1976–2005 frames as continuous administration.
 */
export function buildModernHistoryDisplay(source, national, context, manifest) {
  const projection = national.projection;
  const land = nationalLandGeoJson(national);
  const timorProjected = context.features.map(feature => ({ ...feature, geometry: projectGeometry(feature.geometry, projection) }));
  const nationalLand = unionFeatures(land.features);
  const timorLand = unionFeatures(timorProjected);
  const masks = {
    // Mixed-resolution datasets overlap slightly. Do not color any Timor-Leste reference land as Indonesia outside the occupation period.
    indonesia: polygonClipping.difference(nationalLand, timorLand),
    papua: unionFeatures(land.features.filter(feature => /^9/.test(feature.properties.code))),
    timor: timorLand
  };
  const indonesiaReference = {
    type: 'Feature', id: `reference:indonesia:${manifest.boundaryEdition}`,
    properties: {
      id: 'indonesia', name: `Indonesia reference land · ${manifest.boundaryEdition}`,
      source: manifest.source, boundary_edition: manifest.boundaryEdition,
      license: manifest.license, attribution: manifest.attribution,
      interpretation: 'Current BPS/OCHA reference land with the Natural Earth Timor-Leste reference excluded to avoid mixed-edition overlap. This is not a1945 control map, treaty-boundary verification, or proof of sovereignty.',
      context_source: context.metadata.source, context_license: context.metadata.license
    },
    geometry: inverseGeometry({ type: 'MultiPolygon', coordinates: masks.indonesia }, projection)
  };
  const timorReference = {
    ...context.features[0],
    properties: {
      ...context.features[0].properties,
      name: 'Timor-Leste reference land · Natural Earth 5.1.1',
      source: context.metadata.source, source_sha256: context.metadata.source_sha256,
      license: context.metadata.license, attribution: context.metadata.attribution,
      interpretation: 'Modern reference land, not evidence of historical sovereignty or uniform military control.'
    }
  };
  const features = source.features.flatMap(feature => reconstructionPieces(feature, masks, projection));
  // No 1945 source frame exists. Show only a clearly qualified declaration/reference extent.
  features.push(referenceDisplay('indonesia', 1945, 1945, indonesiaReference, 'declared_claim_reference_not_effective_control'));
  // Independent statehood is documented for 2002; the paper's first Timor frame is 2006.
  features.push(referenceDisplay('timor-leste', 2002, 2005, timorReference, 'independent_state_reference_not_surveyed_historical_frontier'));
  for (const [polityId, reference] of [['indonesia', indonesiaReference], ['timor-leste', timorReference]]) {
    features.push(referenceDisplay(polityId, 2025, HISTORY_PRESENT_YEAR, reference, 'current_reference_not_live_border_observation', true));
  }
  return {
    features,
    context_land: {
      ...context,
      metadata: { ...context.metadata, display_operation: 'Reference land outside the national base only, preventing duplicate 3D surfaces; original Timor-Leste reference geometry remains separately available.' },
      features: context.features.map(feature => ({
        ...feature, id: `context:${feature.properties.id}:outside-national`,
        geometry: inverseGeometry({ type: 'MultiPolygon', coordinates: polygonClipping.difference(timorLand, nationalLand) }, projection)
      }))
    },
    reference_geometries: { type: 'FeatureCollection', features: [indonesiaReference, timorReference] },
    interpretation: 'Annual post-transition display: West New Guinea is excluded from Indonesian reconstructed administration before 1963. East Timor is included only for 1976–98, explicitly as unrecognized occupation/annexation; 1999 is shown after withdrawal and UN transition, not as 2002 independence. Source reconstructions do not establish uniform effective control. Modern reference coastlines do not assert historical frontiers. No source frame is extrapolated past 2024; 2025 onward uses separately attributed current references.'
  };
}
