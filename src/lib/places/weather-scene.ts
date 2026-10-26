/** Maps BMKG weather codes to one of a few animated clay scenes, and estimates day or night at a longitude. */
export type WeatherSceneKind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'mist';

const THUNDER_CODES = new Set([17, 95, 97]);
const MIST_CODES = new Set([5, 10, 45]);
const SUNRISE_HOUR = 6;
const SUNSET_HOUR = 18;

export function sceneForWeather(code: number): WeatherSceneKind {
  if (THUNDER_CODES.has(code)) return 'storm';
  if (code >= 60 && code <= 90) return 'rain';
  if (MIST_CODES.has(code)) return 'mist';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  return 'cloudy';
}

/** Solar-time approximation (15 degrees of longitude per hour); good enough to pick a sun or a moon. */
export function isDaytimeAt(isoInstant: string, longitude: number): boolean {
  const time = new Date(isoInstant);
  const utcHours = time.getUTCHours() + time.getUTCMinutes() / 60;
  const solarHours = (utcHours + longitude / 15 + 24) % 24;
  return solarHours >= SUNRISE_HOUR && solarHours < SUNSET_HOUR;
}
