// The one normalised disaster event every source is converted to before presentation.
import { DISASTER_TYPES } from './classify.mjs';
import { cleanText, roundCoordinate } from './text.mjs';

export const EVENT_KINDS = ['official', 'citizen', 'news'];
export const PRECISIONS = ['point', 'regency', 'province'];

/** Stable 53-bit string hash (cyrb53). Pure JavaScript so Node and Cloudflare Workers produce identical ids. */
export function shortHash(value) {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & second) + (first >>> 0);
  return combined.toString(16).padStart(14, '0');
}

function integerOrUndefined(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100_000_000) return undefined;
  return Math.round(number);
}

/** Keeps only the impact counts that are real non-negative integers. */
export function cleanImpact(impact) {
  if (!impact) return undefined;
  const cleaned = {};
  for (const key of ['deaths', 'missing', 'injured', 'housesDamaged', 'housesFlooded', 'facilitiesDamaged']) {
    const value = integerOrUndefined(impact[key]);
    if (value !== undefined) cleaned[key] = value;
  }
  if (Object.keys(cleaned).length === 0) return undefined;
  return cleaned;
}

/**
 * Builds a validated event or throws with the reason. Coordinates are kept only for point/regency precision,
 * so a province-level match can never be drawn as if it were an exact location.
 */
export function makeEvent(input) {
  if (!EVENT_KINDS.includes(input.kind)) throw Error('invalid-kind');
  if (!DISASTER_TYPES.includes(input.type)) throw Error('invalid-type');
  const occurredAt = Date.parse(input.occurredAt);
  if (!Number.isFinite(occurredAt)) throw Error('invalid-date');
  const title = cleanText(input.title, 220);
  if (title.length < 4) throw Error('empty-title');
  const event = {
    id: input.id, kind: input.kind, source: cleanText(input.source, 60), type: input.type,
    title, occurredAt: new Date(occurredAt).toISOString(), place: cleanText(input.place ?? '', 160)
  };
  if (input.regionCode) event.regionCode = input.regionCode;
  if (input.precision) {
    if (!PRECISIONS.includes(input.precision)) throw Error('invalid-precision');
    event.precision = input.precision;
  }
  const hasPoint = Number.isFinite(input.lon) && Number.isFinite(input.lat) && Math.abs(input.lon) <= 180 && Math.abs(input.lat) <= 90;
  if (hasPoint && (input.precision === 'point' || input.precision === 'regency')) {
    event.lon = roundCoordinate(input.lon);
    event.lat = roundCoordinate(input.lat);
  }
  if (input.url) event.url = input.url;
  if (input.detail) event.detail = cleanText(input.detail, 240);
  const impact = cleanImpact(input.impact);
  if (impact) event.impact = impact;
  if (Number.isFinite(input.floodDepthCm)) event.floodDepthCm = Math.round(input.floodDepthCm);
  if (input.alsoReportedBy?.length) event.alsoReportedBy = input.alsoReportedBy.slice(0, 5);
  return event;
}

/** Counts rejection reasons so the pipeline report shows why records were dropped. */
export class RejectionCounter {
  constructor() { this.reasons = new Map(); }
  add(reason) { this.reasons.set(reason, (this.reasons.get(reason) ?? 0) + 1); }
  toObject() { return Object.fromEntries(this.reasons); }
}
