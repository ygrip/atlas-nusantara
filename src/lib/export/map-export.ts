/** Plain, localisation-free description of the data behind a map view, and its three file formats. */
export type ExportFormat = 'json' | 'csv' | 'xml';
export type ExportValue = string | number | null;

export interface ExportColumn {
  /** Machine name: lowercase letters, digits and underscores, so it is a valid CSV header and XML element name. */
  id: string;
}

export interface ExportDataset {
  /** Layer id, e.g. "warning" or "mountains". */
  layer: string;
  title: string;
  /** Where the data applies: "Indonesia", a province or a city. */
  scope: string;
  generatedAt: string;
  source?: string;
  sourceUrl?: string;
  attribution?: string;
  /** When the underlying data was captured or is valid for. */
  dataTime?: string;
  columns: ExportColumn[];
  rows: Record<string, ExportValue>[];
}

export interface ExportFile {
  content: string;
  mimeType: string;
  extension: string;
}

const FORMATS: Record<ExportFormat, { mimeType: string; extension: string }> = {
  json: { mimeType: 'application/json', extension: 'json' },
  csv: { mimeType: 'text/csv', extension: 'csv' },
  xml: { mimeType: 'application/xml', extension: 'xml' }
};

const COLUMN_ID = /^[a-z][a-z0-9_]*$/;
const BYTE_ORDER_MARK = '\uFEFF';
/** A spreadsheet runs text that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function metadataOf(dataset: ExportDataset): Record<string, string | number> {
  const metadata: Record<string, string | number> = {
    layer: dataset.layer,
    title: dataset.title,
    scope: dataset.scope,
    generated_at: dataset.generatedAt,
    record_count: dataset.rows.length
  };
  if (dataset.source) metadata.source = dataset.source;
  if (dataset.sourceUrl) metadata.source_url = dataset.sourceUrl;
  if (dataset.attribution) metadata.attribution = dataset.attribution;
  if (dataset.dataTime) metadata.data_time = dataset.dataTime;
  return metadata;
}

function assertColumns(dataset: ExportDataset): void {
  for (const column of dataset.columns) {
    if (!COLUMN_ID.test(column.id)) throw Error('Invalid export column id: ' + column.id);
  }
}

function cellOf(row: Record<string, ExportValue>, id: string): ExportValue {
  const value = row[id];
  if (value === undefined) return null;
  return value;
}

export function toJson(dataset: ExportDataset): string {
  assertColumns(dataset);
  const records = dataset.rows.map(row => {
    const record: Record<string, ExportValue> = {};
    for (const column of dataset.columns) record[column.id] = cellOf(row, column.id);
    return record;
  });
  return JSON.stringify({ metadata: metadataOf(dataset), records }, null, 2) + '\n';
}

function csvCell(value: ExportValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value;
  if (FORMULA_START.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

/** RFC 4180 table with a header row. A byte order mark lets Excel read the UTF-8 names correctly. */
export function toCsv(dataset: ExportDataset): string {
  assertColumns(dataset);
  const lines = [dataset.columns.map(column => column.id).join(',')];
  for (const row of dataset.rows) lines.push(dataset.columns.map(column => csvCell(cellOf(row, column.id))).join(','));
  return BYTE_ORDER_MARK + lines.join('\r\n') + '\r\n';
}

/** Removes characters XML 1.0 cannot carry, then escapes the five markup characters. */
export function escapeXml(text: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  return clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function xmlElement(name: string, value: ExportValue, indent: string): string {
  if (value === null) return indent + '<' + name + ' nil="true"/>';
  return indent + '<' + name + '>' + escapeXml(String(value)) + '</' + name + '>';
}

export function toXml(dataset: ExportDataset): string {
  assertColumns(dataset);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<dataset>', '  <metadata>'];
  for (const [name, value] of Object.entries(metadataOf(dataset))) lines.push(xmlElement(name, value, '    '));
  lines.push('  </metadata>', '  <records count="' + dataset.rows.length + '">');
  for (const row of dataset.rows) {
    lines.push('    <record>');
    for (const column of dataset.columns) lines.push(xmlElement(column.id, cellOf(row, column.id), '      '));
    lines.push('    </record>');
  }
  lines.push('  </records>', '</dataset>');
  return lines.join('\n') + '\n';
}

export function serializeDataset(dataset: ExportDataset, format: ExportFormat): ExportFile {
  const { mimeType, extension } = FORMATS[format];
  if (format === 'json') return { content: toJson(dataset), mimeType, extension };
  if (format === 'csv') return { content: toCsv(dataset), mimeType, extension };
  return { content: toXml(dataset), mimeType, extension };
}

function slug(text: string): string {
  const folded = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** e.g. nusantara-mountains-indonesia-20250131.csv */
export function exportFileName(dataset: ExportDataset, format: ExportFormat): string {
  const day = dataset.generatedAt.slice(0, 10).replace(/-/g, '');
  const parts = ['nusantara', slug(dataset.layer), slug(dataset.scope), day].filter(part => part.length > 0);
  return parts.join('-') + '.' + FORMATS[format].extension;
}
