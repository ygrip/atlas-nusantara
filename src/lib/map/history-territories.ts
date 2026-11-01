import { projectLonLat, type MercatorProjection } from './projection.ts';

export interface HistoricalTerritory {
  type: 'Feature';
  properties: { id: string; from: number; to: number; sourceName: string };
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface HistoricalTerritoryCollection {
  type: 'FeatureCollection';
  features: HistoricalTerritory[];
}

/** Project every ring separately so islands and interior holes remain intact. */
export function territoryPath(territory: HistoricalTerritory, projection: MercatorProjection): string {
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
