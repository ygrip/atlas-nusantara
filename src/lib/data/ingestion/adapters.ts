import { makeSnapshot, validateInstant, type DatasetProvenance, type DatasetRecord, type DatasetType, type Snapshot } from './schema.ts';

export interface RegionIndex { has(code: string): boolean }
export interface AdapterOptions { provenance: DatasetProvenance; generatedAt: string; regions: RegionIndex }
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 };
const ZONES: Record<string, string> = { WIB: '+07:00', WITA: '+08:00', WIT: '+09:00' };

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is missing`);
  return value.trim();
}

function toIsoDate(value: unknown, dateField: unknown, timeField: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    validateInstant(value, 'DateTime');
    const parsed = new Date(value);
    return parsed.toISOString();
  }
  const date = readText(dateField, 'Tanggal');
  const time = readText(timeField, 'Jam');
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(date);
  if (!match || MONTHS[match[2].toLowerCase()] === undefined) throw new Error(`BMKG date is invalid: ${date}`);
  const clock = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s+(WIB|WITA|WIT)$/i.exec(time);
  if (!clock) throw new Error(`BMKG time must include WIB, WITA, or WIT: ${time}`);
  const day = Number(match[1]);
  const year = Number(match[3]);
  const month = MONTHS[match[2].toLowerCase()];
  const calendarCheck = new Date(Date.UTC(year, month, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month || calendarCheck.getUTCDate() !== day) throw new Error(`BMKG date is invalid: ${date}`);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const second = Number(clock[3]);
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`BMKG time is invalid: ${time}`);
  const zone = ZONES[clock[5].toUpperCase()];
  const iso = `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}T${clock[1]}:${clock[2]}:${clock[3]}.${(clock[4] ?? '').padEnd(3, '0')}${zone}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) throw new Error(`BMKG date is invalid: ${date}`);
  return parsed.toISOString();
}

function finiteNumber(value: unknown, field: string): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !value.trim())) throw new Error(`${field} is missing`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be numeric`);
  return number;
}

function splitCoordinates(value: string): [number, number] {
  const parts = value.split(',');
  if (parts.length !== 2 || parts.some(part => !part.trim())) throw new Error(`BMKG coordinates are invalid: ${value}`);
  const latitude = Number(parts[0].trim());
  const longitude = Number(parts[1].trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error(`BMKG coordinates are invalid: ${value}`);
  return [longitude, latitude];
}

function normalizeCodes(codes: string[], regions: RegionIndex): Pick<DatasetRecord, 'regionCodes' | 'unmatchedRegionCodes'> {
  const uniqueCodes = [...new Set(codes)];
  return { regionCodes: uniqueCodes.filter(code => regions.has(code)), unmatchedRegionCodes: uniqueCodes.filter(code => !regions.has(code)) };
}

function earthquakeRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object' || !('Infogempa' in payload)) throw new Error('expected BMKG earthquake JSON with Infogempa.gempa');
  const info = (payload as { Infogempa?: { gempa?: unknown } }).Infogempa;
  if (!info || (Array.isArray(info.gempa) === false && (!info.gempa || typeof info.gempa !== 'object'))) throw new Error('expected Infogempa.gempa object or array');
  let rows = [info.gempa];
  if (Array.isArray(info.gempa)) rows = info.gempa;
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('earthquake record must be an object');
  return rows as Record<string, unknown>[];
}

/** BMKG earthquake source: observations only, never a warning or prediction. */
export function adaptBmkgEarthquakes(payload: unknown, options: AdapterOptions): Snapshot {
  const records = earthquakeRows(payload).map((item): DatasetRecord => {
    const [longitude, latitude] = splitCoordinates(readText(item.Coordinates, 'Coordinates'));
    const time = toIsoDate(item.DateTime, item.Tanggal, item.Jam);
    const magnitude = finiteNumber(item.Magnitude, 'Magnitude');
    const depth = finiteNumber(readText(item.Kedalaman, 'Kedalaman').replace(/\s*km$/i, ''), 'Kedalaman');
    const place = readText(item.Wilayah, 'Wilayah');
    let potential: string | null = null;
    if (item.Potensi !== undefined) potential = readText(item.Potensi, 'Potensi');
    return { id: `bmkg-earthquake:${time}:${longitude}:${latitude}`, type: 'earthquake', observedAt: time,
      ...normalizeCodes([], options.regions), geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: { magnitude, depthKm: depth, place, potential } };
  });
  return makeSnapshot(options.provenance, records, options.generatedAt, 'earthquake');
}

export function adaptCanonicalFeed(type: DatasetType, payload: unknown, options: AdapterOptions): Snapshot {
  if (!['warning', 'incident', 'hazard'].includes(type)) throw new Error('canonical dataset type is invalid');
  if (!payload || typeof payload !== 'object' || !('records' in payload) || !Array.isArray((payload as { records?: unknown }).records)) throw new Error('expected an explicitly mapped canonical { records: [...] } feed');
  const records = (payload as { records: unknown[] }).records.map((raw): DatasetRecord => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('canonical record must be an object');
    const record = raw as DatasetRecord;
    if (record.type !== type) throw new Error(`record type must be ${type}`);
    if (!Array.isArray(record.regionCodes) || !Array.isArray(record.unmatchedRegionCodes)) throw new Error('region code lists must be arrays');
    const codes = [...record.regionCodes, ...record.unmatchedRegionCodes];
    return { ...record, ...normalizeCodes(codes, options.regions) };
  });
  return makeSnapshot(options.provenance, records, options.generatedAt, type);
}

export function adaptBmkgWarnings(payload: unknown, options: AdapterOptions): Snapshot { return adaptCanonicalFeed('warning', payload, options); }
export function adaptBnpbIncidents(payload: unknown, options: AdapterOptions): Snapshot { return adaptCanonicalFeed('incident', payload, options); }
export function adaptInariskHazards(payload: unknown, options: AdapterOptions): Snapshot { return adaptCanonicalFeed('hazard', payload, options); }
