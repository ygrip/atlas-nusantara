import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { makeSnapshot, validateInstant, type DatasetRecord, type DatasetProvenance, type Snapshot } from './schema.ts';

const CAP_NAMESPACE = 'urn:oasis:names:tc:emergency:cap:1.2';
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  removeNSPrefix: false,
  isArray: (tagName: string) => ['info', 'area', 'polygon'].includes(tagName)
});

export interface CapOptions {
  provenance: DatasetProvenance;
  generatedAt: string;
  now?: string;
}

type XmlObject = Record<string, unknown>;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error('CAP ' + field + ' is required');
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value.trim();
}

function asObject(value: unknown, field: string): XmlObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CAP ' + field + ' is invalid');
  return value as XmlObject;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function validateSourceUrl(value: string): void {
  let source: URL;
  try {
    source = new URL(value);
  } catch {
    throw new Error('CAP source URL must be an absolute BMKG URL');
  }
  if (source.protocol !== 'https:' || source.hostname !== 'www.bmkg.go.id' || source.port || source.username || source.password || source.search || source.hash) {
    throw new Error('CAP source URL must use the official BMKG HTTPS host');
  }
  // BMKG's filename token is not the CAP identifier; never equate them.
  if (!/^\/alerts\/nowcast\/id\/[A-Za-z0-9_-]+_alert\.xml$/.test(source.pathname)) {
    throw new Error('CAP source URL must identify an official warning document');
  }
}

function parsePolygon(value: unknown): number[][] {
  const text = requiredText(value, 'area polygon');
  const positions = text.trim().split(/\s+/).map((pair) => {
    const values = pair.split(',');
    if (values.length !== 2) throw new Error('CAP polygon coordinates must be latitude,longitude pairs');
    const latitude = Number(values[0]);
    const longitude = Number(values[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error('CAP polygon coordinates are outside valid geographic bounds');
    }
    return [longitude, latitude];
  });
  if (positions.length < 4) throw new Error('CAP polygon must contain at least four positions');
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('CAP polygon ring must be closed');
  return positions;
}

function infoAreas(info: XmlObject): { coordinates: number[][][][]; descriptions: string[] } {
  const coordinates: number[][][][] = [];
  const descriptions: string[] = [];
  for (const item of asArray(info.area)) {
    const area = asObject(item, 'area');
    const description = optionalText(area.areaDesc);
    if (description) descriptions.push(description);
    for (const polygon of asArray(area.polygon)) coordinates.push([parsePolygon(polygon)]);
  }
  if (coordinates.length === 0) throw new Error('CAP warning must include supported polygon areas');
  return { coordinates, descriptions };
}

/** Parse one official active BMKG CAP warning. No administrative code is inferred from area names. */
export function adaptBmkgCap(xml: string, options: CapOptions): Snapshot {
  if (typeof xml !== 'string' || xml.length === 0 || xml.length > 2_000_000) throw new Error('CAP XML must be a non-empty document under 2 MB');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('CAP XML document types and entities are forbidden');
  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) throw new Error('Malformed CAP XML');
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new Error('Malformed CAP XML');
  }
  const document = asObject(parsed, 'document');
  const alert = asObject(document.alert, 'alert');
  if (alert['@_xmlns'] !== CAP_NAMESPACE) throw new Error('Expected OASIS CAP 1.2 alert namespace');
  const identifier = requiredText(alert.identifier, 'identifier');
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(identifier)) throw new Error('CAP identifier contains unsupported characters');
  const sender = requiredText(alert.sender, 'sender');
  if (!/^[^\s@]+@(?:[a-z0-9-]+\.)*bmkg\.go\.id$/i.test(sender)) throw new Error('CAP sender must be an official BMKG address');
  if (requiredText(alert.status, 'status') !== 'Actual') throw new Error('Only actual CAP warnings can be published');
  if (requiredText(alert.msgType, 'msgType') !== 'Alert') throw new Error('Only original CAP alerts are supported');
  if (requiredText(alert.scope, 'scope') !== 'Public') throw new Error('Only public CAP warnings can be published');

  const provenance = options.provenance;
  if (provenance.source !== 'BMKG') throw new Error('CAP provenance source must be BMKG');
  validateSourceUrl(provenance.sourceUrl);
  const sent = requiredText(alert.sent, 'sent');
  const infoItems = asArray(alert.info).map((item) => asObject(item, 'info'));
  const info = infoItems.find((item) => item.language === 'id') ?? infoItems[0];
  if (!info) throw new Error('CAP info section is required');
  const effective = requiredText(info.effective, 'effective');
  const expires = requiredText(info.expires, 'expires');
  for (const [value, field] of [[sent, 'sent'], [effective, 'effective'], [expires, 'expires']]) validateInstant(value, field);
  const sentTime = Date.parse(sent);
  const effectiveTime = Date.parse(effective);
  const expiryTime = Date.parse(expires);
  const now = options.now ?? options.generatedAt;
  const nowTime = Date.parse(now);
  if ([sentTime, effectiveTime, expiryTime, nowTime].some((value) => !Number.isFinite(value))) throw new Error('CAP dates must be valid ISO-8601 instants');
  if (sentTime > nowTime || effectiveTime > expiryTime) throw new Error('CAP warning dates are inconsistent');
  if (effectiveTime > nowTime) throw new Error('Future CAP warnings are not active and cannot be published');
  if (expiryTime <= nowTime) throw new Error('Expired CAP warnings cannot be published');

  const sourceLink = provenance.sourceUrl;
  const { coordinates, descriptions } = infoAreas(info);
  const record: DatasetRecord = {
    id: 'bmkg-cap:' + identifier,
    type: 'warning',
    observedAt: sent,
    regionCodes: [],
    unmatchedRegionCodes: [],
    geometry: { type: 'MultiPolygon', coordinates },
    properties: {
      effective,
      expires,
      headline: requiredText(info.headline, 'headline'),
      description: requiredText(info.description, 'description'),
      event: requiredText(info.event, 'event'),
      senderName: optionalText(info.senderName) ?? 'Badan Meteorologi, Klimatologi, dan Geofisika',
      sourceLink,
      areaDescriptions: descriptions.join('; '),
      urgency: optionalText(info.urgency),
      severity: optionalText(info.severity),
      certainty: optionalText(info.certainty),
      areaCount: coordinates.length
    }
  };
  const snapshotProvenance = { ...provenance, sourcePublishedAt: sent, validUntil: expires };
  return makeSnapshot(snapshotProvenance, [record], options.generatedAt, 'warning');
}
