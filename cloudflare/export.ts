const PAGE_SIZE = 500;
const RETENTION_DAYS = 365;
const MAX_EXPORT_ROWS = 20000;
const MAX_EXPORT_BYTES = 10000000;
const MAX_ENCODED_BYTES = 32000000;

interface ExportRow {
  id: string; source_id: string; kind: string; observed_at: string | null;
  expires_at: string | null; first_seen_at: string; payload_json: string; archive_time: string;
}
export interface ExportSource { id: string; sourceUrl: string; termsUrl: string; license: string; licenseUrl: string }
export interface ArchiveWindow { from: string; to: string }
interface ExportDatabase {
  prepare(query: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function csvRecord(row: ExportRow, sources: ExportSource[]): string {
  const record = JSON.parse(row.payload_json);
  const source = sources.find(item => item.id === row.source_id);
  return [row.id, row.source_id, row.kind, row.observed_at, row.expires_at, row.first_seen_at, JSON.stringify(record.regionCodes ?? []), JSON.stringify(record.unmatchedRegionCodes ?? []), JSON.stringify(record.properties ?? {}), JSON.stringify(record.geometry ?? null), source?.sourceUrl, source?.license, source?.licenseUrl].map(csvCell).join(',') + '\n';
}

function exportQuery(kind: string, sourceIds: string[], now: number, window?: ArchiveWindow) {
  const cutoff = new Date(now - RETENTION_DAYS * 86400000).toISOString();
  let from = cutoff;
  let to = new Date(now).toISOString();
  if (window) { from = window.from; to = window.to; }
  const placeholders = sourceIds.map(() => '?').join(',');
  const where = `kind = ? AND source_id IN (${placeholders}) AND first_seen_at > ? AND first_seen_at <= ? AND (observed_at IS NULL OR observed_at > ?) AND COALESCE(observed_at, first_seen_at) >= ? AND COALESCE(observed_at, first_seen_at) < ?`;
  return { where, bindings: [kind, ...sourceIds, cutoff, new Date(now).toISOString(), cutoff, from, to] };
}

/** Bound database work before opening a stream; oversized requests never return a partial archive. */
export async function exportFitsBudget(db: ExportDatabase, kind: string, sourceIds: string[], now: number, window: ArchiveWindow, sources: ExportSource[] = []): Promise<boolean> {
  if (!sourceIds.length) return false;
  const query = exportQuery(kind, sourceIds, now, window);
  const result = await db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(bytes), 0) AS bytes FROM (SELECT length(CAST(payload_json AS BLOB)) AS bytes FROM observations WHERE ${query.where} LIMIT ${MAX_EXPORT_ROWS + 1})`).bind(...query.bindings).all<{ count: number; bytes: number }>();
  const limits = result.results[0];
  if (!limits || limits.count > MAX_EXPORT_ROWS || limits.bytes > MAX_EXPORT_BYTES) return false;
  const encoder = new TextEncoder();
  const attributionBytes = Math.max(0, ...sources.map(source => encoder.encode([source.sourceUrl, source.license, source.licenseUrl].map(csvCell).join(',')).byteLength));
  const headerBytes = 1024 + encoder.encode(JSON.stringify(sources)).byteLength;
  const conservativeEncodedBytes = limits.bytes * 2 + limits.count * (512 + attributionBytes) + headerBytes;
  return conservativeEncodedBytes <= MAX_ENCODED_BYTES;
}

export function createExportResponse(db: ExportDatabase, kind: string, format: 'json' | 'csv', sourceIds: string[], now: number, sources: ExportSource[] = [], window?: ArchiveWindow): Response {
  const generatedAt = new Date(now).toISOString();
  if (!sourceIds.length) return Response.json({ status: 'unavailable', reason: 'No approved source is configured for this dataset.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  let contentType = 'text/csv; charset=utf-8';
  if (format === 'json') contentType = 'application/json; charset=utf-8';
  const headers = new Headers({
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-disposition': `attachment; filename="nusantara-${kind}-${generatedAt.slice(0, 10)}.${format}"`,
    'content-type': contentType
  });
  const selection = exportQuery(kind, sourceIds, now, window);
  const query = `SELECT id, source_id, kind, observed_at, expires_at, first_seen_at, payload_json, COALESCE(observed_at, first_seen_at) AS archive_time FROM observations WHERE ${selection.where} AND (COALESCE(observed_at, first_seen_at), id) > (?, ?) ORDER BY COALESCE(observed_at, first_seen_at), id LIMIT ${PAGE_SIZE}`;
  const encoder = new TextEncoder();
  let rows: ExportRow[] = [];
  let rowIndex = 0;
  let lastId = '';
  let lastTime = '';
  let written = 0;
  let started = false;
  let finished = false;
  let cancelled = false;
  let outputBytes = 0;
  function encodeChunk(text: string): Uint8Array {
    const chunk = encoder.encode(text);
    outputBytes += chunk.byteLength;
    if (outputBytes > MAX_ENCODED_BYTES) throw Error('Encoded archive exceeds the download budget; choose a narrower date range');
    return chunk;
  }
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          if (format === 'json') controller.enqueue(encodeChunk(JSON.stringify({ generatedAt, retentionDays: RETENTION_DAYS, scope: 'retained records; warnings are historical archive, not current alerts', kind, sources, window }).slice(0, -1) + ',"records":['));
          if (format === 'csv') controller.enqueue(encodeChunk('id,source_id,kind,observed_at,expires_at,first_seen_at,region_codes,unmatched_region_codes,properties,geometry,source_url,license,license_url\n'));
          return;
        }
        if (rowIndex >= rows.length && !finished) {
          const result = await db.prepare(query).bind(...selection.bindings, lastTime, lastId).all<ExportRow>();
          if (cancelled) return;
          rows = result.results;
          rowIndex = 0;
          if (!rows.length) finished = true;
        }
        if (finished) {
          if (format === 'json') controller.enqueue(encodeChunk(']}'));
          rows = [];
          controller.close();
          return;
        }
        const row = rows[rowIndex];
        let line = csvRecord(row, sources);
        if (format === 'json') {
          line = JSON.stringify({ ...JSON.parse(row.payload_json), id: row.id, sourceId: row.source_id, kind: row.kind, observedAt: row.observed_at, expiresAt: row.expires_at, firstSeenAt: row.first_seen_at });
          if (written > 0) line = ',' + line;
        }
        controller.enqueue(encodeChunk(line));
        lastId = row.id;
        lastTime = row.archive_time ?? row.observed_at ?? row.first_seen_at;
        rowIndex += 1;
        written += 1;
      } catch (error) { rows = []; finished = true; if (!cancelled) controller.error(error); }
    },
    cancel() { cancelled = true; rows = []; }
  });
  return new Response(stream, { headers });
}
