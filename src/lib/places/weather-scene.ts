/** Maps BMKG weather codes to one of a few animated clay scenes, and works out whether the sun is up at a place. */
export type WeatherSceneKind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'mist';

const THUNDER_CODES = new Set([17, 95, 97]);
const MIST_CODES = new Set([5, 10, 45]);
/** The sun counts as risen once its upper edge clears the horizon, allowing for atmospheric refraction. */
const HORIZON_ELEVATION_DEGREES = -0.833;
const MILLISECONDS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN_DAY = 2440587.5;
const J2000_JULIAN_DAY = 2451545;

export function sceneForWeather(code: number): WeatherSceneKind {
  if (THUNDER_CODES.has(code)) return 'storm';
  if (code >= 60 && code <= 90) return 'rain';
  if (MIST_CODES.has(code)) return 'mist';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  return 'cloudy';
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function wrapDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Height of the sun above the horizon in degrees for a place and instant (low-precision NOAA formulas,
 * accurate to about a minute of sunrise or sunset, which is plenty to choose between a sun and a moon).
 */
export function solarElevationDegrees(isoInstant: string, latitude: number, longitude: number): number {
  const julianDay = Date.parse(isoInstant) / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DAY;
  const daysSinceJ2000 = julianDay - J2000_JULIAN_DAY;
  const meanLongitude = wrapDegrees(280.46 + 0.9856474 * daysSinceJ2000);
  const meanAnomaly = toRadians(wrapDegrees(357.528 + 0.9856003 * daysSinceJ2000));
  const eclipticLongitude = toRadians(meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = toRadians(23.439 - 0.0000004 * daysSinceJ2000);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const greenwichSiderealDegrees = wrapDegrees((18.697374558 + 24.06570982441908 * daysSinceJ2000) * 15);
  const hourAngle = toRadians(wrapDegrees(greenwichSiderealDegrees + longitude) - toDegrees(rightAscension));
  const latitudeRadians = toRadians(latitude);
  const sine = Math.sin(latitudeRadians) * Math.sin(declination) + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  return toDegrees(Math.asin(sine));
}

/** True between sunrise and sunset at the given place. */
export function isDaytimeAt(isoInstant: string, latitude: number, longitude: number): boolean {
  return solarElevationDegrees(isoInstant, latitude, longitude) > HORIZON_ELEVATION_DEGREES;
}
