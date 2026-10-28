import { m } from '$lib/paraglide/messages.js';
import type { EarthquakeArchive } from '$lib/data/earthquakes';
import { activeWarnings, eventColor, eventLabel, EVENT_KINDS, EVENT_TYPES, hasMapPoint, kindLabel, kindSymbol, severityColor, type HazardSnapshot } from '$lib/data/hazards';

import type { OverlayDefinition, PointOverlay } from './overlay-contract';
export { loadPointOverlay, validatePointOverlay } from './overlay-contract';
export type { MapPin, PinSymbol, OverlayLegend, PointOverlay, OverlayDefinition } from './overlay-contract';

export const OVERLAY_DEFINITIONS: OverlayDefinition[] = [
  { id: 'warning', label: m.layer_forecast, source: 'BMKG', renderer: 'weather', icon: 'weather' },
  { id: 'earthquake', label: m.layer_earthquakes, source: 'BMKG', renderer: 'points', icon: 'earthquake' },
  { id: 'mountains', label: m.layer_mountains, source: 'BIG', renderer: 'points', icon: 'mountain', snapshotUrl: '/data/observations/mountains.json' },
  { id: 'incident', label: m.layer_disaster_reports, source: 'BNPB · PetaBencana', renderer: 'points', icon: 'incident' },
  { id: 'hazard', label: m.layer_weather_hazards, source: 'BMKG', renderer: 'points', icon: 'hazard' },
  { id: 'destinations', label: m.layer_destinations, source: 'Tourism', renderer: 'points', icon: 'landmark' },
  { id: 'cuisine', label: m.layer_cuisine, source: 'Wikipedia · recipes', renderer: 'points', icon: 'food' },
  // Yearly national statistics shown in a panel (pyramid and history); no map pins, no worker. See docs/OVERLAYS.md.
  { id: 'population', label: m.layer_population, source: 'BPS', renderer: 'statistics', icon: 'population' }
];

export function earthquakeOverlay(archive: EarthquakeArchive): PointOverlay {
  return {
    id: 'earthquake', color: '#cf482b', symbol: 'circle', source: 'BMKG', sourceUrl: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini', fetchedAt: archive.fetchedAt,
    legend: [{ label: m.layer_earthquakes() + ' · M5+', color: '#cf482b', symbol: 'circle' }],
    pins: archive.events.map(event => ({
      id: event.id, lon: event.lon, lat: event.lat, label: 'M' + event.magnitude.toFixed(1) + ' · ' + event.place,
      description: event.observedAt + ' · ' + event.depthKm + ' km', value: event.magnitude
    }))
  };
}

/** Disaster events from every pipeline source. Only events with a real or regency-centre point are pinned. */
export function reportsOverlay(snapshot: HazardSnapshot): PointOverlay {
  const pinned = snapshot.events.items.filter(hasMapPoint);
  const presentTypes = EVENT_TYPES.filter(type => pinned.some(event => event.type === type));
  const presentKinds = EVENT_KINDS.filter(kind => pinned.some(event => event.kind === kind));
  const typeLegend = presentTypes.map(type => ({ label: eventLabel(type), color: eventColor(type), symbol: 'circle' as const }));
  const kindLegend = presentKinds.map(kind => ({ label: kindLabel(kind), color: '#6b6258', symbol: kindSymbol(kind) }));
  return {
    id: 'incident', color: '#2f7fc1', symbol: 'circle', source: 'BNPB · PetaBencana · ANTARA · GDELT',
    attribution: snapshot.events.sources.map(source => source.attribution).join(' '), fetchedAt: snapshot.fetchedAt,
    legend: [...typeLegend, ...kindLegend],
    pins: pinned.map(event => {
      const label = eventLabel(event.type) + (event.place ? ' · ' + event.place : '');
      return {
        id: event.id, lon: event.lon as number, lat: event.lat as number, color: eventColor(event.type), symbol: kindSymbol(event.kind),
        sourceUrl: event.url, label, description: event.occurredAt + ' · ' + kindLabel(event.kind) + ' · ' + event.title
      };
    })
  };
}

/** Active BMKG CAP weather warnings, pinned at the centre of the warned area. No region codes are inferred. */
export function warningsOverlay(snapshot: HazardSnapshot, now: number): PointOverlay {
  const warnings = activeWarnings(snapshot, now);
  return {
    id: 'hazard', color: '#e59a2f', symbol: 'triangle', source: snapshot.warnings.source, sourceUrl: snapshot.warnings.sourceUrl,
    attribution: snapshot.warnings.attribution, fetchedAt: snapshot.fetchedAt,
    legend: [
      { label: m.hazard_severity_moderate(), color: severityColor('Moderate'), symbol: 'triangle' },
      { label: m.hazard_severity_severe(), color: severityColor('Severe'), symbol: 'triangle' },
      { label: m.hazard_severity_extreme(), color: severityColor('Extreme'), symbol: 'triangle' }
    ],
    pins: warnings.map(warning => ({
      id: warning.id, lon: warning.centroid.lon, lat: warning.centroid.lat, color: severityColor(warning.severity), symbol: 'triangle' as const,
      label: warning.headline, description: warning.effective + ' → ' + warning.expires
    }))
  };
}
