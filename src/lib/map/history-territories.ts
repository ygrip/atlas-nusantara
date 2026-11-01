import { projectLonLat, type MercatorProjection } from './projection.ts';

export type HistoryPolygonGeometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
export interface HistoryReferenceFeature {
  type: 'Feature'; id?: string;
  properties: { id: string; name: string; [key: string]: unknown };
  geometry: HistoryPolygonGeometry;
}
export interface HistoryReferenceCollection { type: 'FeatureCollection'; features: HistoryReferenceFeature[]; metadata?: Record<string, unknown> }

export interface HistoricalTerritory {
  type: 'Feature';
  id?: string;
  properties: {
    id: string; from: number; to: number; sourceName: string;
    modern?: boolean; source_snapshot_id?: string; source_from?: number; source_to?: number;
    reference_id?: string; reference_ongoing?: boolean; render_role?: string; regional_status_ids?: string[];
  };
  geometry: HistoryPolygonGeometry;
}

export interface HistoricalTerritoryCollection {
  type: 'FeatureCollection';
  features: HistoricalTerritory[];
  context_land?: HistoryReferenceCollection;
  reference_geometries?: HistoryReferenceCollection;
  metadata?: Record<string, unknown>;
}

const geometryKeys = new WeakMap<object, string>();
/** Period metadata must not restart an unchanged map shape's animation. */
export function territoryGeometryKey(feature: HistoricalTerritory): string {
  let key = geometryKeys.get(feature.geometry);
  if (key === undefined) {
    key = JSON.stringify(feature.geometry);
    geometryKeys.set(feature.geometry, key);
  }
  return feature.properties.id + ':' + key;
}

/** Stable across filtering and source-array reordering; never derive a snapshot identity from its index. */
export function historicalTerritoryId(feature: HistoricalTerritory): string {
  const properties = feature.properties;
  if (properties.source_snapshot_id) return properties.source_snapshot_id;
  if (properties.reference_id) return properties.reference_id;
  return `territory:${properties.id}:${properties.from}:${properties.to}:${encodeURIComponent(properties.sourceName)}`;
}

/** Ongoing reference geometry stays a dated edition, never an extrapolated historical source frame. */
export function territoryVisibleAt(feature: HistoricalTerritory, year: number): boolean {
  if (!Number.isInteger(year) || year < feature.properties.from) return false;
  if (feature.properties.reference_ongoing) return true;
  return year <= feature.properties.to;
}

/** Keep a dated source outline only while both its reconstruction and catalogue polity are active. */
export function activeHistoricalTerritories(
  collection: HistoricalTerritoryCollection | undefined,
  activePolities: ReadonlyMap<string, { from: number; to: number }>,
  year: number
): HistoricalTerritory[] {
  if (!collection) return [];
  return collection.features.filter(feature => {
    const polity = activePolities.get(feature.properties.id);
    return polity !== undefined && polity.from <= year && year <= polity.to
      && territoryVisibleAt(feature, year);
  });
}

/** Project every ring separately so islands and interior holes remain intact. */
export function territoryPath(territory: Pick<HistoricalTerritory, 'geometry'>, projection: MercatorProjection): string {
  let polygons: number[][][][];
  if (territory.geometry.type === 'Polygon') polygons = [territory.geometry.coordinates];
  else polygons = territory.geometry.coordinates;
  const paths: string[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ring.length < 4) continue;
      const points = ring.map(([lon, lat]) => {
        const point = projectLonLat(projection, lon, lat);
        return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      });
      paths.push(`M${points.join('L')}Z`);
    }
  }
  return paths.join('');
}
