import { m } from '$lib/i18n/messages';
import { isBmkgSource, loadSavedSnapshot } from './saved-snapshot.ts';

/** Disaster types: PetaBencana's six plus the BNPB/news categories (landslide, drought, tide, tsunami). */
export const EVENT_TYPES = ['flood', 'landslide', 'earthquake', 'volcano', 'fire', 'haze', 'wind', 'drought', 'tide', 'tsunami'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_KINDS = ['official', 'citizen', 'news'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventPrecision = 'point' | 'regency' | 'province';

export interface EventImpact {
  deaths?: number;
  missing?: number;
  injured?: number;
  housesDamaged?: number;
  housesFlooded?: number;
  facilitiesDamaged?: number;
}

/** One cleaned disaster event from the pipeline (scripts/pipeline). Coordinates exist only for point/regency precision. */
export interface DisasterEvent {
  id: string;
  kind: EventKind;
  source: string;
  type: EventType;
  title: string;
  occurredAt: string;
  place: string;
  regionCode?: string;
  precision?: EventPrecision;
  lon?: number;
  lat?: number;
  url?: string;
  detail?: string;
  impact?: EventImpact;
  floodDepthCm?: number;
  alsoReportedBy?: { source: string; url: string }[];
}

export interface EventSource {
  id: string;
  name: string;
  url: string;
  termsUrl: string;
  attribution: string;
}

export interface PipelineSourceStatus {
  id: string;
  name: string;
  status: 'ok' | 'failed' | 'carried-over';
  fetched: number;
  kept: number;
}

export interface HazardWarning {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: string | null;
  urgency: string | null;
  certainty: string | null;
  effective: string;
  expires: string;
  areaDescriptions: string;
  sourceLink: string;
  centroid: { lon: number; lat: number };
}

interface SourceBlock {
  source: string;
  sourceUrl: string;
  termsUrl: string;
  attribution: string;
}

export interface HazardSnapshot {
  schemaVersion: 2;
  kind: 'hazard-snapshot';
  fetchedAt: string;
  warnings: SourceBlock & { coverage: string; items: HazardWarning[] };
  events: { sources: EventSource[]; items: DisasterEvent[] };
  pipeline: { mergedNews: number; sources: PipelineSourceStatus[] };
}

const MAX_WARNINGS = 100;
const MAX_EVENTS = 2000;
const MAX_SOURCES = 12;

let pending: Promise<HazardSnapshot | undefined> | undefined;
let cachedAt = 0;

export async function loadHazards(): Promise<HazardSnapshot | undefined> {
  if (!pending || Date.now() - cachedAt >= 15 * 60_000) {
    cachedAt = Date.now();
    pending = loadSavedSnapshot('/data/observations/hazards.json', isHazardSnapshot);
  }
  return pending;
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function isValidCoordinate(lon: unknown, lat: unknown): boolean {
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
}

function isEventImpact(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(count => Number.isInteger(count) && (count as number) >= 0);
}

function isDisasterEvent(value: DisasterEvent): boolean {
  if (!value.id || !EVENT_KINDS.includes(value.kind) || !EVENT_TYPES.includes(value.type)) return false;
  if (typeof value.title !== 'string' || typeof value.place !== 'string' || typeof value.source !== 'string') return false;
  if (!Number.isFinite(Date.parse(value.occurredAt))) return false;
  if (value.url !== undefined && !isHttpsUrl(value.url)) return false;
  const hasPoint = value.lon !== undefined || value.lat !== undefined;
  if (hasPoint && !isValidCoordinate(value.lon, value.lat)) return false;
  return isEventImpact(value.impact);
}

function isEventSource(value: EventSource): boolean {
  return Boolean(value.id) && isHttpsUrl(value.url) && isHttpsUrl(value.termsUrl) && typeof value.attribution === 'string';
}

function isHazardWarning(value: HazardWarning): boolean {
  if (!value.id || typeof value.headline !== 'string' || typeof value.event !== 'string') return false;
  if (!Number.isFinite(Date.parse(value.effective)) || !Number.isFinite(Date.parse(value.expires))) return false;
  if (!value.centroid || !isValidCoordinate(value.centroid.lon, value.centroid.lat)) return false;
  return isBmkgSource(value.sourceLink);
}

function hasUniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map(item => item.id)).size === items.length;
}

export function isHazardSnapshot(value: unknown): value is HazardSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as HazardSnapshot;
  if (snapshot.schemaVersion !== 2 || snapshot.kind !== 'hazard-snapshot' || !Number.isFinite(Date.parse(snapshot.fetchedAt))) return false;
  const { warnings, events, pipeline } = snapshot;
  if (!warnings || !events || !pipeline || !Array.isArray(warnings.items) || !Array.isArray(events.items) || !Array.isArray(events.sources)) return false;
  if (warnings.items.length > MAX_WARNINGS || events.items.length > MAX_EVENTS || events.sources.length > MAX_SOURCES) return false;
  if (!isBmkgSource(warnings.sourceUrl) || !isBmkgSource(warnings.termsUrl)) return false;
  if (!events.sources.every(isEventSource) || !events.items.every(isDisasterEvent) || !warnings.items.every(isHazardWarning)) return false;
  return hasUniqueIds(warnings.items) && hasUniqueIds(events.items);
}

/** CAP severity values are a closed vocabulary; unknown values fall back to the lowest-emphasis colour. */
export function severityColor(severity: string | null): string {
  if (severity === 'Extreme') return '#8f1f3d';
  if (severity === 'Severe') return '#cf482b';
  if (severity === 'Moderate') return '#e59a2f';
  return '#c9b23d';
}

const EVENT_COLORS: Record<EventType, string> = {
  flood: '#2f7fc1',
  landslide: '#8a6b4a',
  earthquake: '#7a4f3a',
  volcano: '#a33b53',
  fire: '#d9531e',
  haze: '#9c8b7a',
  wind: '#4f9aa0',
  drought: '#c9a13d',
  tide: '#3b6fa8',
  tsunami: '#25508c'
};

export function eventColor(type: EventType): string {
  return EVENT_COLORS[type];
}

export function eventLabel(type: EventType): string {
  if (type === 'flood') return m.hazard_type_flood();
  if (type === 'landslide') return m.hazard_type_landslide();
  if (type === 'earthquake') return m.hazard_type_earthquake();
  if (type === 'volcano') return m.hazard_type_volcano();
  if (type === 'fire') return m.hazard_type_fire();
  if (type === 'haze') return m.hazard_type_haze();
  if (type === 'wind') return m.hazard_type_wind();
  if (type === 'drought') return m.hazard_type_drought();
  if (type === 'tide') return m.hazard_type_tide();
  return m.hazard_type_tsunami();
}

export function kindLabel(kind: EventKind): string {
  if (kind === 'official') return m.hazard_kind_official();
  if (kind === 'citizen') return m.hazard_kind_citizen();
  return m.hazard_kind_news();
}

/** Official records are diamonds, citizen reports circles and news triangles, so provenance reads at a glance. */
export function kindSymbol(kind: EventKind): 'circle' | 'triangle' | 'diamond' {
  if (kind === 'official') return 'diamond';
  if (kind === 'citizen') return 'circle';
  return 'triangle';
}

export function hasMapPoint(event: DisasterEvent): boolean {
  return event.lon !== undefined && event.lat !== undefined;
}

export function activeWarnings(snapshot: HazardSnapshot, now: number): HazardWarning[] {
  return snapshot.warnings.items.filter(item => Date.parse(item.expires) > now);
}
