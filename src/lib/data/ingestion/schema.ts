export type DatasetType = 'warning' | 'earthquake' | 'incident' | 'hazard';

export interface DatasetProvenance {
  source: string;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  fetchedAt: string;
  validUntil: string | null;
  license: string;
  licenseUrl: string;
  reviewedBy: string;
  reviewedAt: string;
  coverage: string[];
  edition: string | null;
}

export interface DatasetRecord {
  id: string;
  type: DatasetType;
  observedAt: string | null;
  regionCodes: string[];
  unmatchedRegionCodes: string[];
  geometry: unknown | null;
  properties: Record<string, string | number | boolean | null>;
}

export interface Snapshot {
  schemaVersion: 1;
  generatedAt: string;
  provenance: DatasetProvenance;
  records: DatasetRecord[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ADMIN_CODE = /^\d{2}(?:\.\d{2}){0,2}$/;
const DATASET_TYPES = new Set<DatasetType>(['warning', 'earthquake', 'incident', 'hazard']);
const ALLOWED_LICENSES = new Set(['CC-BY-4.0', 'CC0-1.0', 'ODbL-1.0', 'MIT', 'Public-Domain']);

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
}

export function validateInstant(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-8601 timestamp with timezone`);
  }
}

export function validateProvenance(provenance: unknown, type?: DatasetType): asserts provenance is DatasetProvenance {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new Error('provenance must be an object');
  const candidate = provenance as Record<string, unknown>;
  for (const field of ['source', 'license', 'licenseUrl', 'reviewedBy', 'reviewedAt']) requireText(candidate[field], field);
  if (!ALLOWED_LICENSES.has(candidate.license as string)) throw new Error('license must be an approved SPDX identifier or Public-Domain');
  let sourceUrl: URL;
  let licenseUrl: URL;
  try {
    sourceUrl = new URL(candidate.sourceUrl as string);
    licenseUrl = new URL(candidate.licenseUrl as string);
  } catch {
    throw new Error('sourceUrl and licenseUrl must be absolute HTTPS URLs');
  }
  if (sourceUrl.protocol !== 'https:' || licenseUrl.protocol !== 'https:') throw new Error('sourceUrl and licenseUrl must use HTTPS');
  validateInstant(candidate.fetchedAt, 'fetchedAt');
  validateInstant(candidate.reviewedAt, 'reviewedAt');
  if (candidate.sourcePublishedAt !== null) validateInstant(candidate.sourcePublishedAt, 'sourcePublishedAt');
  if (candidate.validUntil !== null) validateInstant(candidate.validUntil, 'validUntil');
  if (type === 'warning' && candidate.validUntil === null) throw new Error('warning validUntil is required');
  if (candidate.validUntil !== null && candidate.sourcePublishedAt !== null && Date.parse(candidate.validUntil as string) <= Date.parse(candidate.sourcePublishedAt as string)) {
    throw new Error('validUntil must be after sourcePublishedAt');
  }
  if (!Array.isArray(candidate.coverage) || candidate.coverage.some(item => typeof item !== 'string' || !item.trim())) throw new Error('coverage must be an explicit list; use [] when unknown');
  if (candidate.edition !== null && typeof candidate.edition !== 'string') throw new Error('edition must be a string or null');
}

export function validateRecord(value: unknown, expectedType?: DatasetType): asserts value is DatasetRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('record must be an object');
  const record = value as Record<string, unknown>;
  requireText(record.id, 'record id');
  if (typeof record.type !== 'string' || !DATASET_TYPES.has(record.type as DatasetType)) throw new Error('record type is invalid');
  if (expectedType && record.type !== expectedType) throw new Error(`record type must be ${expectedType}`);
  if (record.observedAt !== null) validateInstant(record.observedAt, 'observedAt');
  for (const field of ['regionCodes', 'unmatchedRegionCodes']) {
    if (!Array.isArray(record[field]) || (record[field] as unknown[]).some(code => typeof code !== 'string' || !ADMIN_CODE.test(code))) {
      throw new Error(`${field} must contain zero-padded administrative codes`);
    }
  }
  if (record.geometry !== null && (typeof record.geometry !== 'object' || Array.isArray(record.geometry))) throw new Error('geometry must be an object or null');
  if (!record.properties || typeof record.properties !== 'object' || Array.isArray(record.properties)) throw new Error('properties must be a scalar object');
  for (const property of Object.values(record.properties as Record<string, unknown>)) {
    if (property !== null && !['string', 'number', 'boolean'].includes(typeof property)) throw new Error('properties may contain only scalar values');
    if (typeof property === 'number' && !Number.isFinite(property)) throw new Error('properties may not contain non-finite numbers');
  }
}

export function makeSnapshot(provenance: unknown, records: unknown, generatedAt: unknown, expectedType?: DatasetType): Snapshot {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  let provenanceType = expectedType;
  if (records.length === 0) provenanceType = undefined;
  if (records.some(record => record?.type === 'warning')) provenanceType = 'warning';
  validateProvenance(provenance, provenanceType);
  validateInstant(generatedAt, 'generatedAt');
  records.forEach(record => validateRecord(record, expectedType));
  const ids = new Set<string>();
  for (const record of records as DatasetRecord[]) {
    if (ids.has(record.id)) throw new Error(`duplicate record id: ${record.id}`);
    ids.add(record.id);
  }
  return { schemaVersion: 1, generatedAt, provenance, records };
}
