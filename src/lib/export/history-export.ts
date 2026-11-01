import { HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MIN_YEAR, HISTORY_MAX_YEAR, HISTORY_LEGACY_CUTOFF_YEAR, type HistoricalPolity } from '../data/history.ts';
import { curatedPolityFor, type HistoryDossier, type HistoryResearch } from '../data/history-catalogue.ts';
import { MODERN_MILESTONES, MODERN_STATUS_PHASES } from '../data/history-modern.ts';
import type { HistoryInventory } from '../data/history-inventory.ts';
import { historicalTerritoryId, territoryVisibleAt, type HistoricalTerritory, type HistoricalTerritoryCollection } from '../map/history-territories.ts';
import type { ExportDataset, ExportDocument, ExportNode, ExportValue } from './map-export.ts';

const TERRITORY_SOURCE = 'https://github.com/Seshat-Global-History-Databank/cliopatria';

interface HistoryExportOptions {
  territories: HistoricalTerritoryCollection;
  generatedAt?: string;
  inventory?: HistoryInventory;
  research?: HistoryResearch;
  renderedTerritories?: HistoricalTerritoryCollection;
  year?: number;
}
interface GeometryContext extends ExportDocument { year: number | null; role: string }
interface PolitySnapshot { geometry: ExportNode; context: GeometryContext }

function sourceSnapshot(polity: HistoricalPolity, snapshots: HistoricalTerritory[], year: number, clipped: boolean): PolitySnapshot {
  let role = 'dated_source_reconstruction';
  if (clipped) role = 'dated_reconstruction_clipped_to_display_mask';
  if (snapshots[0].properties.render_role) role = snapshots[0].properties.render_role;
  let geometry = snapshots[0].geometry as unknown as ExportNode;
  if (snapshots.length > 1) {
    geometry = null;
    role = 'ambiguous_multiple_source_snapshots';
  }
  return {
    geometry,
    context: {
      year, role,
      valid_from: Math.max(polity.from, ...snapshots.map(snapshot => snapshot.properties.from)),
      valid_to: Math.min(polity.to, ...snapshots.map(snapshot => {
        if (snapshot.properties.reference_ongoing) return polity.to;
        return snapshot.properties.to;
      })),
      source_territory_ids: snapshots.filter(snapshot => !snapshot.properties.reference_id).map(historicalTerritoryId),
      reference_geometry_ids: snapshots.flatMap(snapshot => {
        if (!snapshot.properties.reference_id) return [];
        return [snapshot.properties.reference_id];
      }),
      regional_status_ids: [...new Set(snapshots.flatMap(snapshot => snapshot.properties.regional_status_ids ?? []))],
      source_intervals: snapshots.filter(snapshot => !snapshot.properties.reference_id).map(snapshot => ({ from: snapshot.properties.source_from ?? snapshot.properties.from, to: snapshot.properties.source_to ?? snapshot.properties.to, source_name: snapshot.properties.sourceName }))
    }
  };
}

function politySnapshot(polity: HistoricalPolity, territories: HistoricalTerritoryCollection, year: number | undefined, clipped: boolean): PolitySnapshot {
  if (year === undefined) return { geometry: null, context: { year: null, role: 'all_time_archive_no_single_geometry' } };
  if (year < polity.from || year > polity.to) return { geometry: null, context: { year, role: 'inactive_in_snapshot_year' } };
  const snapshots = territories.features.filter(snapshot => snapshot.properties.id === polity.id && territoryVisibleAt(snapshot, year));
  if (snapshots.length > 0) return sourceSnapshot(polity, snapshots, year, clipped);
  const centre = polity.zones.find(zone => zone.confidence !== 'contested-influence' && (zone.from ?? polity.from) <= year && year <= (zone.to ?? polity.to));
  if (!centre) return { geometry: null, context: { year, role: 'active_without_supported_geometry' } };
  return {
    geometry: { type: 'Point', coordinates: [centre.lon, centre.lat] },
    context: {
      year, role: 'approximate_reference_point_not_capital_or_boundary', confidence: centre.confidence,
      valid_from: Math.max(polity.from, centre.from ?? polity.from), valid_to: Math.min(polity.to, centre.to ?? polity.to)
    }
  };
}

function displayCutoff(polity: HistoricalPolity): number | null {
  if (polity.to === HISTORY_LEGACY_CUTOFF_YEAR) return HISTORY_LEGACY_CUTOFF_YEAR;
  if (polity.ongoing) return HISTORY_MAX_YEAR;
  return null;
}

/** One polity/source record per feature; timeline waypoints never become extra polity rows. */
export function buildHistoryExport({ territories, generatedAt = new Date().toISOString(), inventory, research, renderedTerritories, year }: HistoryExportOptions): ExportDataset {
  if (year !== undefined && (!Number.isInteger(year) || year < HISTORY_MIN_YEAR || year > HISTORY_MAX_YEAR)) throw new Error('Invalid historical export snapshot year');
  let geometryTerritories = territories;
  let clipped = false;
  if (renderedTerritories) {
    geometryTerritories = renderedTerritories;
    clipped = true;
  }
  const territoryFeatures = territories.features.map(feature => ({
    type: 'Feature', id: historicalTerritoryId(feature), geometry: feature.geometry,
    properties: {
      polity_id: feature.properties.id,
      from: feature.properties.from, to: feature.properties.to,
      source_name: feature.properties.sourceName,
      source_url: TERRITORY_SOURCE, license: 'CC-BY-4.0',
      interpretation: 'Dated reconstruction; not a surveyed frontier. Catalogue and source dates may differ.'
    }
  }));
  if (new Set(territoryFeatures.map(feature => feature.id)).size !== territoryFeatures.length) throw new Error('Historical territory snapshot identity collision');
  const researchByCuratedId = new Map<string, HistoryDossier[]>();
  const additionalDossiers: HistoryDossier[] = [];
  for (const dossier of research?.features ?? []) {
    const polityId = curatedPolityFor(dossier);
    if (!polityId) {
      additionalDossiers.push(dossier);
      continue;
    }
    const linked = researchByCuratedId.get(polityId) ?? [];
    linked.push(dossier);
    researchByCuratedId.set(polityId, linked);
  }
  const features = HISTORICAL_POLITIES.map(polity => {
    const snapshot = politySnapshot(polity, geometryTerritories, year, clipped);
    const locations = polity.zones.map(zone => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [zone.lon, zone.lat] },
      properties: {
        from: zone.from ?? polity.from, to: zone.to ?? polity.to,
        confidence: zone.confidence, schematic_radius_km: zone.radiusKm,
        geometry_role: 'approximate_centre_or_influence_reference_not_boundary'
      }
    }));
    return {
      type: 'Feature', id: polity.id,
      // Spatial data is scoped to the selected year; archives have no timeless boundary.
      geometry: snapshot.geometry,
      properties: {
        name: polity.name, category: polity.category, region: polity.region,
        geometry_context: snapshot.context,
        period: { from: polity.from, to: polity.to, from_date: polity.fromDate ?? null, ongoing: polity.ongoing ?? false, calendar: 'historical_year_no_year_zero', inclusive: true, display_cutoff: displayCutoff(polity) },
        place: { en: polity.place, id: polity.placeId },
        summary: polity.summary, date_note: polity.dateNote ?? null,
        rulers: polity.rulers.map(ruler => ({
          name: ruler.name, from: ruler.from ?? null, to: ruler.to ?? null,
          uncertain: ruler.uncertain ?? false, ongoing: ruler.ongoing ?? false
        })),
        locations,
        territory_ids: territoryFeatures.filter(feature => feature.properties.polity_id === polity.id).map(feature => feature.id),
        sources: polity.sources.map(url => ({ url })),
        review_status: 'curated_overview_requires_specialist_review',
        research_dossier_ids: (researchByCuratedId.get(polity.id) ?? []).map(dossier => dossier.id)
      }
    };
  });
  const researchFeatures = additionalDossiers.map(dossier => ({
    type: 'Feature', id: dossier.id, geometry: null,
    properties: {
      name: dossier.properties.source_label, category: null, region: null, period: null,
      geometry_context: { year: year ?? null, role: 'undated_research_record' },
      summary: null, rulers: [], locations: [], territory_ids: [],
      sources: [
        { url: dossier.properties.source_url, role: 'discovery_source' },
        ...dossier.properties.articles.map(article => ({ url: article.url, role: 'attributed_article', license: article.license })),
        ...(dossier.properties.web_research?.sources ?? []).map(source => ({ url: source.url, role: 'search_lead_requires_review' }))
      ],
      review_status: dossier.properties.review_status, research_dossier: dossier.properties,
      research_dossier_ids: [dossier.id]
    }
  }));
  const document: ExportDocument = {
    type: 'FeatureCollection',
    schema_version: '1.0.0',
    metadata: {
      title: 'Nusantara historical polities', generated_at: generatedAt,
      polity_record_count: features.length + researchFeatures.length,
      dated_curated_count: features.length, research_record_count: researchFeatures.length,
      territory_snapshot_count: territoryFeatures.length, snapshot_year: year ?? null,
      timeline: { from: HISTORY_MIN_YEAR, to: HISTORY_MAX_YEAR },
      geometry_note: 'Feature geometry describes snapshot_year only: dated reconstruction polygons or explicitly labelled approximate reference points. Inactive/undated records, ambiguous simultaneous reconstructions and all-time archives have null geometry. Points are not verified capitals; schematic radii are not borders. Full source and display-clipped territory time series remain separate.',
      coverage_note: 'Legacy royal profiles stop at the 1944 catalogue cutoff, not necessarily dissolution. Modern Indonesia and Timor-Leste continue to the current year. Modern status distinguishes claims, administration, occupation and recognized independence, not comprehensive military control. Research-only records remain unverified source entries, not a census of kingdoms. Unknown dates and borders are not inferred.',
      territory_attribution: { source_url: TERRITORY_SOURCE, authors: 'Bennett et al.; Seshat Global History Databank', license: 'CC-BY-4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/' }
    },
    features: [...features, ...researchFeatures] as ExportNode[],
    territories: { type: 'FeatureCollection', features: territoryFeatures },
    milestones: [
      ...HISTORY_EVENTS.filter(event => event.year < 1945).map(event => ({ year: event.year, date: null, label: { en: event.en, id: event.id } })),
      ...MODERN_MILESTONES.map(event => ({ id: event.id, year: Number(event.date.slice(0, 4)), date: event.date, kind: event.kind, region: event.region, label: event.note, sources: [...event.sources] }))
    ],
    territorial_status: MODERN_STATUS_PHASES as unknown as ExportNode,
    reference_geometries: (renderedTerritories?.reference_geometries ?? null) as unknown as ExportNode,
    context_land: (renderedTerritories?.context_land ?? null) as unknown as ExportNode,
    discovery_inventory: (inventory ?? null) as unknown as ExportNode,
    research_sources: (research ?? null) as unknown as ExportNode,
    rendered_territories: (renderedTerritories ?? null) as unknown as ExportNode
  };
  const geometryProvenance = JSON.stringify({
    source_metadata: geometryTerritories.metadata ?? null,
    reference_sources: renderedTerritories?.reference_geometries?.features.map(feature => feature.properties) ?? [],
    context_sources: renderedTerritories?.context_land?.features.map(feature => feature.properties) ?? []
  });
  const rows: Record<string, ExportValue>[] = features.map(feature => ({
    id: feature.id, name: feature.properties.name,
    from: feature.properties.period.from, to: feature.properties.period.to,
    period: JSON.stringify(feature.properties.period),
    geometry_context: JSON.stringify(feature.properties.geometry_context), geometry_provenance: geometryProvenance,
    snapshot_year: year ?? null, geometry_role: feature.properties.geometry_context.role, geometry: JSON.stringify(feature.geometry),
    category: feature.properties.category, region: feature.properties.region,
    place_en: feature.properties.place.en, place_id: feature.properties.place.id,
    summary_en: feature.properties.summary.en, summary_id: feature.properties.summary.id,
    date_note_en: feature.properties.date_note?.en ?? null,
    date_note_id: feature.properties.date_note?.id ?? null,
    rulers: JSON.stringify(feature.properties.rulers),
    locations: JSON.stringify(feature.properties.locations),
    territory_ids: JSON.stringify(feature.properties.territory_ids),
    sources: JSON.stringify(feature.properties.sources),
    review_status: feature.properties.review_status,
    research_dossier_ids: JSON.stringify(feature.properties.research_dossier_ids),
    research_dossier: JSON.stringify((researchByCuratedId.get(feature.id) ?? []).map(dossier => dossier.properties))
  }));
  for (const feature of researchFeatures) rows.push({
    id: feature.id, name: feature.properties.name, from: null, to: null, period: null,
    geometry_context: JSON.stringify(feature.properties.geometry_context), geometry_provenance: null,
    snapshot_year: year ?? null, geometry_role: feature.properties.geometry_context.role, geometry: JSON.stringify(feature.geometry),
    category: null, region: null, place_en: null, place_id: null,
    summary_en: null, summary_id: null, date_note_en: null, date_note_id: null,
    rulers: '[]', locations: '[]', territory_ids: '[]',
    sources: JSON.stringify(feature.properties.sources), review_status: feature.properties.review_status,
    research_dossier_ids: JSON.stringify(feature.properties.research_dossier_ids),
    research_dossier: JSON.stringify([feature.properties.research_dossier])
  });
  return {
    layer: 'history', title: 'Nusantara historical polities', scope: 'Nusantara historical catalogue',
    generatedAt, source: 'Curated Nusantara history atlas; Cliopatria v0.2.1',
    sourceUrl: TERRITORY_SOURCE,
    attribution: 'Territory reconstructions: Bennett et al., CC BY 4.0. Approximate centres are not verified capitals. CSV contains polities only; GeoJSON/JSON/XML retain separate milestones and dated territory snapshots.',
    columns: Object.keys(rows[0]).map(id => ({ id })), rows, document
  };
}
