import { unprojectToLonLat } from '../map/geometry.ts';

export interface Coordinates { lat: number; lon: number }

interface Projection { scale: number; translate: [number, number] }
interface BoxedRegion { sourceCode: string; bbox: [number, number, number, number] }

/** Centre of each region's bounding box on the map plane, converted back to latitude and longitude. */
export function regionCoordinatesByCode(regions: BoxedRegion[], projection: Projection | undefined): Map<string, Coordinates> {
  const coordinates = new Map<string, Coordinates>();
  if (!projection) return coordinates;
  for (const region of regions) {
    const [minX, minY, maxX, maxY] = region.bbox;
    const centre = unprojectToLonLat(projection, (minX + maxX) / 2, (minY + maxY) / 2);
    coordinates.set(region.sourceCode, { lat: centre.lat, lon: centre.lon });
  }
  return coordinates;
}

/** Signed decimal degrees with two decimals, e.g. `-6.23`. */
export function formatDegrees(value: number): string {
  return value.toFixed(2);
}
