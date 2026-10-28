/** The d3 Mercator projection parameters used by the national geographic package. */
export interface MercatorProjection {
  scale: number;
  translate: [number, number];
}

/** Longitude/latitude projected to the 1000 × 500 SVG plane, without a graphics-engine dependency. */
export function projectLonLat(projection: MercatorProjection, lon: number, lat: number): { x: number; y: number } {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const x = projection.translate[0] + projection.scale * lambda;
  const y = projection.translate[1] - projection.scale * Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return { x, y };
}

/** Inverse projection: recover longitude/latitude (degrees) from a point on the national SVG plane. */
export function unprojectToLonLat(projection: MercatorProjection, x: number, y: number): { lon: number; lat: number } {
  const lambda = (x - projection.translate[0]) / projection.scale;
  const phi = 2 * Math.atan(Math.exp(-(y - projection.translate[1]) / projection.scale)) - Math.PI / 2;
  return { lon: (lambda * 180) / Math.PI, lat: (phi * 180) / Math.PI };
}
