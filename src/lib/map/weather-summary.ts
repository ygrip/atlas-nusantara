import { forecastStepAt, type ForecastSnapshot, type ForecastStep } from './weather.ts';
import { nearestNeighbour, type Neighbour } from '../data/weather-history-contract.ts';

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
  /** Set when the region has no forecast of its own and this nearby location's forecast stands in for it. */
  neighbour?: Neighbour;
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

function summariseSteps(steps: ForecastStep[]): WeatherSummary | undefined {
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

/** The region's own forecast; a region BMKG returned nothing for borrows the nearest location that has one. */
export function summariseWeather(forecast: ForecastSnapshot, code: string, time: string | undefined): WeatherSummary | undefined {
  const own = summariseSteps(stepsForRegion(forecast, code, time));
  if (own) return own;
  return summariseFromNeighbour(forecast, code, time);
}

function summariseFromNeighbour(forecast: ForecastSnapshot, code: string, time: string | undefined): WeatherSummary | undefined {
  const missing = (forecast.unavailable ?? []).filter(item => pointInRegion(item.code, code));
  if (missing.length === 0 || !time) return undefined;
  const target = { lat: average(missing.map(item => item.lat)), lon: average(missing.map(item => item.lon)) };
  const usable = forecast.points.filter(point => !pointInRegion(point.code, code) && forecastStepAt(point, time));
  const neighbour = nearestNeighbour(usable, target);
  if (!neighbour) return undefined;
  const summary = summariseSteps(stepsForRegion(forecast, neighbour.code, time));
  if (!summary) return undefined;
  return { ...summary, neighbour };
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
