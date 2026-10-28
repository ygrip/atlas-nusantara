import type { WeatherField } from './weather';

/** Inspect data when the forecast changes, not on every animation frame. */
export function weatherActivity(current: WeatherField, next: WeatherField, mix: number) {
  const fields = [current];
  if (mix >= 1) fields[0] = next;
  else if (mix > 0 && next !== current) fields.push(next);
  return {
    cloud: fields.some(field => field.cloud.some(value => value > 0.01) || field.thunder.length > 0),
    rain: fields.some(field => field.rain.some(value => value > 0.01)),
    // Opposing regional winds can have a zero national mean while particles still need to move.
    wind: fields.some(field => field.u.some(value => Math.abs(value) > 0.01) || field.v.some(value => Math.abs(value) > 0.01))
  };
}
