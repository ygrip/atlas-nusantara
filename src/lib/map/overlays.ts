import { m } from '$lib/paraglide/messages.js';
import type { EarthquakeArchive } from '$lib/data/earthquakes';

import type { OverlayDefinition, PointOverlay } from './overlay-contract';
export { loadPointOverlay, validatePointOverlay } from './overlay-contract';
export type { MapPin, PinSymbol, OverlayLegend, PointOverlay, OverlayDefinition } from './overlay-contract';

export const OVERLAY_DEFINITIONS: OverlayDefinition[] = [
  { id: 'warning', label: m.layer_forecast, source: 'BMKG', renderer: 'weather', icon: 'weather' },
  { id: 'earthquake', label: m.layer_earthquakes, source: 'BMKG', renderer: 'points', icon: 'earthquake' },
  { id: 'incident', label: m.layer_history, source: 'BNPB', renderer: 'unavailable', icon: 'incident' },
  { id: 'hazard', label: m.layer_hazards, source: 'InaRISK', renderer: 'unavailable', icon: 'hazard' },
  { id: 'destinations', label: m.layer_destinations, source: 'Tourism', renderer: 'points', icon: 'landmark' }
];

export function earthquakeOverlay(archive: EarthquakeArchive): PointOverlay {
  return {
    id: 'earthquake', color: '#cf482b', symbol: 'circle', source: 'BMKG', fetchedAt: archive.fetchedAt,
    legend: [{ label: m.layer_earthquakes() + ' · M5+', color: '#cf482b', symbol: 'circle' }],
    pins: archive.events.map(event => ({
      id: event.id, lon: event.lon, lat: event.lat, label: 'M' + event.magnitude.toFixed(1) + ' · ' + event.place,
      description: event.observedAt + ' · ' + event.depthKm + ' km', value: event.magnitude
    }))
  };
}
