import { projectLonLat } from './projection.ts';
import { isBmkgSource, loadSavedSnapshot } from '../data/saved-snapshot.ts';
import { CODE_EDITION } from '../atlas/edition.ts';

/** One BMKG forecast step at one representative village. */
export interface ForecastStep {
  at: string;
  t: number;
  hu: number;
  tcc: number;
  tp: number;
  weather: number;
  desc: string;
  /** Direction the wind comes FROM, degrees clockwise from north. */
  wd: number;
  /** Wind speed, km/h. */
  ws: number;
}

export interface ForecastPoint { code: string; adm4: string; lon: number; lat: number; steps: ForecastStep[] }

export interface ForecastSnapshot {
  schemaVersion: 1;
  kind: 'forecast-snapshot';
  source: string;
  sourceUrl: string;
  attribution: string;
  codeEdition: string;
  fetchedAt: string;
  validFrom: string;
  validTo: string;
  coverage: { requested: number; received: number };
  points: ForecastPoint[];
}

/** Gridded fields over the national SVG plane (0..1000 × 0..500), row-major, origin top-left. */
export interface WeatherField {
  width: number;
  height: number;
  /** Wind toward east, km/h. */
  u: Float32Array;
  /** Wind toward south (SVG +y), km/h. */
  v: Float32Array;
  /** Cloud cover 0..1. */
  cloud: Float32Array;
  /** Rain intensity 0..1 (1 ≈ heavy rain). */
  rain: Float32Array;
  /** Projected positions of thunderstorm points at this time. */
  thunder: { x: number; y: number }[];
  meanU: number;
  meanV: number;
}

export const FIELD_WIDTH = 160;
export const FIELD_HEIGHT = 80;
export const PLANE_WIDTH = 1000;
export const PLANE_HEIGHT = 500;

const THUNDER_CODES = new Set([17, 95, 97]);

export async function loadForecast(url: string, signal?: AbortSignal): Promise<ForecastSnapshot | undefined> {
  return loadSavedSnapshot(url, isForecastSnapshot, signal);
}

export function isForecastSnapshot(value: unknown): value is ForecastSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as ForecastSnapshot;
  if (snapshot.kind !== 'forecast-snapshot' || snapshot.schemaVersion !== 1 || snapshot.codeEdition !== CODE_EDITION || !isBmkgSource(snapshot.sourceUrl)) return false;
  if (!Number.isFinite(Date.parse(snapshot.fetchedAt)) || !Number.isFinite(Date.parse(snapshot.validFrom)) || !Number.isFinite(Date.parse(snapshot.validTo))) return false;
  if (!Array.isArray(snapshot.points) || snapshot.points.length === 0 || snapshot.points.length > 1000 || snapshot.coverage?.received !== snapshot.points.length) return false;
  if (!Number.isInteger(snapshot.coverage.requested) || snapshot.coverage.requested < snapshot.points.length || snapshot.coverage.requested > 1000) return false;
  const codes = new Set<string>();
  for (const point of snapshot.points) {
    if (!/^\d{2}\.\d{2}$/.test(point.code) || codes.has(point.code) || !Number.isFinite(point.lon) || !Number.isFinite(point.lat) || Math.abs(point.lon) > 180 || Math.abs(point.lat) > 90) return false;
    codes.add(point.code);
    if (!Array.isArray(point.steps) || point.steps.length === 0 || point.steps.length > 100) return false;
    for (const step of point.steps) {
      if (!Number.isFinite(Date.parse(step.at)) || typeof step.desc !== 'string') return false;
      if (![step.t, step.hu, step.tcc, step.tp, step.weather, step.wd, step.ws].every(Number.isFinite)) return false;
      if (step.hu < 0 || step.hu > 100 || step.tcc < 0 || step.tcc > 100 || step.ws < 0 || step.wd < 0 || step.wd > 360 || step.tp < 0) return false;
    }
  }
  return true;
}

/** Every distinct forecast time in the snapshot, ascending. */
export function forecastTimes(snapshot: ForecastSnapshot): string[] {
  const times = new Set<string>();
  for (const point of snapshot.points) for (const step of point.steps) times.add(step.at);
  return [...times].sort();
}

/** The time step closest to `now`, so the map opens on the most relevant forecast. */
export function nearestTimeIndex(times: string[], now: number): number {
  let best = 0;
  let bestDistance = Infinity;
  times.forEach((time, index) => {
    const distance = Math.abs(Date.parse(time) - now);
    if (distance < bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

export function forecastStepAt(point: ForecastPoint, time: string): ForecastStep | undefined {
  const exact = point.steps.find(step => step.at === time);
  if (exact) return exact;
  const target = Date.parse(time);
  let nearest: ForecastStep | undefined;
  let nearestDistance = Infinity;
  for (const step of point.steps) {
    const distance = Math.abs(Date.parse(step.at) - target);
    if (distance < nearestDistance) { nearest = step; nearestDistance = distance; }
  }
  // A point whose forecast does not reach this time contributes nothing rather than stale weather.
  if (nearestDistance > 3 * 3_600_000) return undefined;
  return nearest;
}

/** BMKG precipitation (mm per 3-hour step) and weather code mapped to a 0..1 rain intensity. */
export function rainIntensity(step: ForecastStep): number {
  let fromCode = 0;
  if (step.weather >= 60 && step.weather < 63) fromCode = 0.35;
  if (step.weather === 63) fromCode = 0.8;
  if (step.weather === 80) fromCode = 0.45;
  if (THUNDER_CODES.has(step.weather)) fromCode = 0.9;
  const fromAmount = Math.min(1, (step.tp ?? 0) / 10);
  return Math.max(fromCode, fromAmount);
}

interface Sample { x: number; y: number; u: number; v: number; cloud: number; rain: number }

function samplesAt(snapshot: ForecastSnapshot, time: string, projection: { scale: number; translate: [number, number] }): { samples: Sample[]; thunder: { x: number; y: number }[] } {
  const samples: Sample[] = [];
  const thunder: { x: number; y: number }[] = [];
  for (const point of snapshot.points) {
    const step = forecastStepAt(point, time);
    if (!step) continue;
    const position = projectLonLat(projection, point.lon, point.lat);
    const radians = (step.wd * Math.PI) / 180;
    // Meteorological direction is where the wind comes from; the vector points where it goes.
    const u = -Math.sin(radians) * step.ws;
    const v = Math.cos(radians) * step.ws;
    samples.push({ x: position.x, y: position.y, u, v, cloud: Math.min(1, Math.max(0, step.tcc / 100)), rain: rainIntensity(step) });
    if (THUNDER_CODES.has(step.weather)) thunder.push({ x: position.x, y: position.y });
  }
  return { samples, thunder };
}

/**
 * Inverse-distance-weighted fields from the forecast points. Far from any point (open ocean)
 * the weight of each point fades, so wind settles to the regional mean instead of inventing extremes.
 */
export function buildField(snapshot: ForecastSnapshot, time: string, projection: { scale: number; translate: [number, number] }): WeatherField {
  const { samples, thunder } = samplesAt(snapshot, time, projection);
  const size = FIELD_WIDTH * FIELD_HEIGHT;
  const field: WeatherField = {
    width: FIELD_WIDTH, height: FIELD_HEIGHT,
    u: new Float32Array(size), v: new Float32Array(size), cloud: new Float32Array(size), rain: new Float32Array(size),
    thunder, meanU: 0, meanV: 0
  };
  if (samples.length === 0) return field;
  for (const sample of samples) { field.meanU += sample.u / samples.length; field.meanV += sample.v / samples.length; }
  const cellWidth = PLANE_WIDTH / FIELD_WIDTH;
  const cellHeight = PLANE_HEIGHT / FIELD_HEIGHT;
  const influence = 40 * 40;
  for (let row = 0; row < FIELD_HEIGHT; row++) {
    for (let column = 0; column < FIELD_WIDTH; column++) {
      const x = (column + 0.5) * cellWidth;
      const y = (row + 0.5) * cellHeight;
      let weightSum = 0;
      let u = 0, v = 0, cloud = 0, rain = 0;
      let nearest = Infinity;
      for (const sample of samples) {
        const distanceSquared = (sample.x - x) ** 2 + (sample.y - y) ** 2 + 4;
        if (distanceSquared < nearest) nearest = distanceSquared;
        const weight = 1 / (distanceSquared * distanceSquared);
        weightSum += weight;
        u += sample.u * weight; v += sample.v * weight; cloud += sample.cloud * weight; rain += sample.rain * weight;
      }
      const index = row * FIELD_WIDTH + column;
      // Blend toward the regional mean and clear sky as distance to the nearest observation grows.
      const local = Math.exp(-nearest / influence);
      field.u[index] = (u / weightSum) * local + field.meanU * (1 - local);
      field.v[index] = (v / weightSum) * local + field.meanV * (1 - local);
      field.cloud[index] = (cloud / weightSum) * (0.35 + 0.65 * local);
      field.rain[index] = (rain / weightSum) * local;
    }
  }
  return field;
}

/** Bilinear sample of one field channel at SVG coordinates. */
export function sampleChannel(field: WeatherField, channel: Float32Array, x: number, y: number): number {
  const fx = Math.min(field.width - 1.001, Math.max(0, x / (PLANE_WIDTH / field.width) - 0.5));
  const fy = Math.min(field.height - 1.001, Math.max(0, y / (PLANE_HEIGHT / field.height) - 0.5));
  const column = Math.floor(fx);
  const row = Math.floor(fy);
  const tx = fx - column;
  const ty = fy - row;
  const index = row * field.width + column;
  const top = channel[index] * (1 - tx) + channel[index + 1] * tx;
  const bottom = channel[index + field.width] * (1 - tx) + channel[index + field.width + 1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Packs u, v (±60 km/h), cloud and rain into RGBA bytes for shaders. */
export function packField(field: WeatherField): Uint8Array {
  const data = new Uint8Array(field.width * field.height * 4);
  for (let index = 0; index < field.width * field.height; index++) {
    data[index * 4] = Math.round(Math.min(1, Math.max(0, field.u[index] / 120 + 0.5)) * 255);
    data[index * 4 + 1] = Math.round(Math.min(1, Math.max(0, field.v[index] / 120 + 0.5)) * 255);
    data[index * 4 + 2] = Math.round(field.cloud[index] * 255);
    data[index * 4 + 3] = Math.round(Math.min(1, field.rain[index]) * 255);
  }
  return data;
}

/** Nearest forecast point to an SVG position, for the hover/selection readout. */
export function nearestPoint(snapshot: ForecastSnapshot, code: string): ForecastPoint | undefined {
  return snapshot.points.find(point => point.code === code || point.code.startsWith(code + '.'));
}
