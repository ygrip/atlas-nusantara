import type { MapPin } from './overlay-contract';

/** Zoom-dependent visual decluttering. The complete inventory remains searchable. */
export function visibleMountainPins(pins: MapPin[], zoom: number, scope: 'national' | 'province' = 'national'): MapPin[] {
  if (scope === 'province' || zoom >= 4) return pins;
  const cell = zoom < 1.6 ? 2 : zoom < 2.8 ? 0.8 : 0.25;
  const occupied = new Set<string>();
  const visible: MapPin[] = [];
  for (const pin of pins) {
    // Every officially classified volcano stays visible, even at national scale.
    if (pin.category === 'active' || pin.category === 'potential') {
      visible.push(pin);
      continue;
    }
    const key = Math.floor(pin.lon / cell) + ':' + Math.floor(pin.lat / cell);
    if (occupied.has(key)) continue;
    occupied.add(key);
    visible.push(pin);
  }
  return visible;
}
