export type ObservatoryKind = 'warning' | 'earthquake' | 'incident' | 'hazard';

const KINDS: ObservatoryKind[] = ['warning', 'earthquake', 'incident', 'hazard'];

/**
 * The observatory summarises collected observations, so it only applies to layers backed by one of the collectors.
 * Layers without a collector (mountains, destinations, population) have no observatory and the section is hidden.
 */
export function observatoryKind(layer: string): ObservatoryKind | undefined {
  return KINDS.find(kind => kind === layer);
}
