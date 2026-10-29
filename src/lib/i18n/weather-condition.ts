import type { MessageKey } from './messages.ts';

/** BMKG's descriptions and numeric codes do not match the older published code table.
 * Translate the description actually supplied, without changing the stored forecast or icon codes. */
const CONDITIONS = new Map<string, MessageKey>([
  ['sunny', 'weather_condition_sunny'],
  ['clear', 'weather_condition_sunny'],
  ['partly cloudy', 'weather_condition_partly_cloudy'],
  ['mostly cloudy', 'weather_condition_mostly_cloudy'],
  ['cloudy', 'weather_condition_cloudy'],
  ['overcast', 'weather_condition_overcast'],
  ['mist/haze', 'weather_condition_mist_haze'],
  ['fog/smoke', 'weather_condition_fog_smoke'],
  ['light rain', 'weather_condition_light_rain'],
  ['moderate rain', 'weather_condition_moderate_rain'],
  ['heavy rain', 'weather_condition_heavy_rain'],
  ['rain', 'weather_condition_rain'],
  ['drizzle', 'weather_condition_drizzle'],
  ['showers', 'weather_condition_showers'],
  ['rain showers', 'weather_condition_showers'],
  ['local rain', 'weather_condition_showers'],
  ['thunder', 'weather_condition_thunder'],
  ['thunderstorm', 'weather_condition_thunderstorm'],
  ['thunderstorms', 'weather_condition_thunderstorm']
]);

/** Unknown provider wording gets an honest localized fallback, never a guessed condition. */
export function weatherConditionKey(description: string): MessageKey {
  const normalized = description.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
  return CONDITIONS.get(normalized) ?? 'weather_condition_unknown';
}
