import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_WEB_IMAGES = 8;
const MAX_URL_LENGTH = 2000;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF rows. */
export function parseCsv(rawText) {
  // Excel/Sheets exports start with a UTF-8 BOM that would corrupt the first header name.
  const text = rawText.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') inQuotes = false;
      else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** @returns {Array<Record<string, string>>} one object per CSV row, keyed by header */
export function parseCsvRecords(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map(row => Object.fromEntries(header.map((name, column) => [name, row[column] ?? ''])));
}

/** Keep only plain https image URLs. Inline data: URIs would bloat every shard. */
export function selectWebImageUrls(sources, max = MAX_WEB_IMAGES) {
  const urls = [];
  for (const source of sources) {
    if (urls.length >= max) break;
    if (typeof source !== 'string' || source.length > MAX_URL_LENGTH || !source.startsWith('https://')) continue;
    if (!urls.includes(source)) urls.push(source);
  }
  return urls;
}

/**
 * Progress is an append-only JSON Lines file. One line is written per finished
 * destination, so a crash loses at most the destination in flight. A torn last
 * line is ignored; a later record for the same ID wins.
 */
export async function loadProgress(filename) {
  let text;
  try { text = await readFile(filename, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  const records = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (typeof record.destinationId === 'string') records.set(record.destinationId, record);
    } catch { /* torn line from an interrupted write */ }
  }
  return records;
}

export async function appendProgress(filename, record) {
  await mkdir(path.dirname(filename), { recursive: true });
  await appendFile(filename, JSON.stringify(record) + '\n');
}

/** Records that should be skipped on resume. */
export function isFinished(record, { retryEmpty = false } = {}) {
  if (!record) return false;
  if (record.status === 'ok') return true;
  return record.status === 'empty' && !retryEmpty;
}
