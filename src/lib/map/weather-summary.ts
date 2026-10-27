import { forecastStepAt, type ForecastSnapshot, type ForecastStep } from './weather.ts';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** One region's forecast at one time: a city is a single forecast point, a province averages its cities. */
export interface WeatherSummary {
  description: string;
  temperature: number;
  humidity: number;
  clouds: number;
  /** Wind speed in km/h. */
  speed: number;
  /** Compass point the wind blows from. */
  from: string;
  /** Degrees clockwise from north that the wind blows towards (for an arrow that points downwind). */
  arrow: number;
  points: number;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** True when a forecast point belongs to the region: the city itself, or any city of a province. */
export function pointInRegion(pointCode: string, regionCode: string): boolean {
  return pointCode === regionCode || pointCode.startsWith(regionCode + '.');
}

/** The forecast steps of every point inside the region at `time`. */
export function stepsForRegion(forecast: ForecastSnapshot, code: string, time: string | undefined): ForecastStep[] {
  const steps: ForecastStep[] = [];
  if (!time) return steps;
  for (const point of forecast.points) {
    if (!pointInRegion(point.code, code)) continue;
    const step = forecastStepAt(point, time);
    if (step) steps.push(step);
  }
  return steps;
}

function dominantDescription(steps: ForecastStep[]): string {
  const counts = new Map<string, number>();
  for (const step of steps) counts.set(step.desc, (counts.get(step.desc) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function summariseWeather(forecast: ForecastSnapshot, code: string, time: string | undefined): WeatherSummary | undefined {
  const steps = stepsForRegion(forecast, code, time);
  if (steps.length === 0) return undefined;
  // Vector-average the wind so opposite directions cancel instead of averaging angles.
  const east = average(steps.map(step => -Math.sin((step.wd * Math.PI) / 180) * step.ws));
  const north = average(steps.map(step => -Math.cos((step.wd * Math.PI) / 180) * step.ws));
  const towards = (Math.atan2(east, north) * 180) / Math.PI;
  const from = (towards + 180 + 360) % 360;
  return {
    description: dominantDescription(steps),
    temperature: Math.round(average(steps.map(step => step.t))),
    humidity: Math.round(average(steps.map(step => step.hu))),
    clouds: Math.round(average(steps.map(step => step.tcc))),
    speed: Math.round(Math.hypot(east, north)),
    from: COMPASS[Math.round(from / 45) % 8],
    arrow: towards,
    points: steps.length
  };
}

/**
 * The forecast restricted to one region, so the 3D weather effects show that area's own sky.
 * Returns undefined when the region has no forecast point, in which case the whole-map weather stays.
 */
export function focusForecast(forecast: ForecastSnapshot, code: string): ForecastSnapshot | undefined {
  const points = forecast.points.filter(point => pointInRegion(point.code, code));
  if (points.length === 0) return undefined;
  return { ...forecast, points, coverage: { requested: points.length, received: points.length } };
}

/** Mean position of the forecast points inside a region, used when no boundary box is available yet. */
export function forecastCoordinates(forecast: ForecastSnapshot, code: string): { lat: number; lon: number } | undefined {
  const points = forecast.points.filter(point => pointInRegion(point.code, code));
  if (points.length === 0) return undefined;
  return { lat: average(points.map(point => point.lat)), lon: average(points.map(point => point.lon)) };
}
