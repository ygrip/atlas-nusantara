// Converts one BMKG CAP warning record (from adaptBmkgCap) to the compact warning shape the browser draws.
import { cleanText, roundCoordinate } from './text.mjs';

export function polygonCentroid(multiPolygon) {
  const ring = multiPolygon.coordinates.map(polygon => polygon[0]).sort((a, b) => b.length - a.length)[0];
  const lons = ring.map(point => point[0]);
  const lats = ring.map(point => point[1]);
  return { lon: roundCoordinate((Math.min(...lons) + Math.max(...lons)) / 2), lat: roundCoordinate((Math.min(...lats) + Math.max(...lats)) / 2) };
}

export function warningFromRecord(record, link) {
  const properties = record.properties;
  return {
    id: record.id, event: properties.event, headline: cleanText(String(properties.headline), 200),
    description: cleanText(String(properties.description), 700), severity: properties.severity, urgency: properties.urgency, certainty: properties.certainty,
    effective: properties.effective, expires: properties.expires, areaDescriptions: cleanText(String(properties.areaDescriptions), 400),
    sourceLink: link, centroid: polygonCentroid(record.geometry)
  };
}
