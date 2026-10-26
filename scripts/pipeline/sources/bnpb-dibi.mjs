// BNPB DIBI (Data Informasi Bencana Indonesia) incident table. Official records with regency codes and impact counts.
import { fetchText } from '../lib/http.mjs';
import { makeEvent, RejectionCounter, shortHash } from '../lib/event.mjs';
import { cleanText, parseInstant, stripHtml } from '../lib/text.mjs';
import { upgradeRegionCode } from '../../../src/lib/atlas/code-upgrades.ts';

export const BNPB = {
  id: 'bnpb', name: 'BNPB DIBI', url: 'https://gis.bnpb.go.id/databencana/tabel/pencarian.php',
  termsUrl: 'https://dibi.bnpb.go.id/',
  attribution: 'Official incident records: Badan Nasional Penanggulangan Bencana (BNPB), DIBI. Preliminary data that may be revised.'
};
const EXPECTED_COLUMNS = 16;
const REQUIRED_HEADERS = ['Kejadian', 'Meninggal', 'Rumah Rusak'];
const TYPE_BY_EVENT = {
  'BANJIR': 'flood', 'TANAH LONGSOR': 'landslide', 'GEMPABUMI': 'earthquake', 'GEMPA BUMI': 'earthquake',
  'ERUPSI GUNUNG API': 'volcano', 'LETUSAN GUNUNG API': 'volcano', 'CUACA EKSTREM': 'wind', 'PUTING BELIUNG': 'wind',
  'GELOMBANG PASANG DAN ABRASI': 'tide', 'GELOMBANG PASANG / ABRASI': 'tide', 'KEKERINGAN': 'drought',
  'KEBAKARAN HUTAN DAN LAHAN': 'fire', 'TSUNAMI': 'tsunami', 'GEMPA BUMI DAN TSUNAMI': 'tsunami'
};
const MAX_AGE_MS = 60 * 24 * 3600 * 1000;

function cellsOf(rowHtml) {
  return [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
}

/** Fails closed when the page layout changes, so a redesign cannot silently shift columns. */
export function parseTable(html) {
  const headerMatch = html.match(/<thead[\s\S]*?<\/thead>/i);
  const headerText = headerMatch ? stripHtml(headerMatch[0]) : '';
  for (const label of REQUIRED_HEADERS) {
    if (!headerText.includes(label)) throw Error('BNPB DIBI table header changed: missing "' + label + '"');
  }
  const body = html.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (!body) throw Error('BNPB DIBI table body is missing');
  const rows = [...body[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => cellsOf(match[1]));
  if (rows.some(cells => cells.length !== EXPECTED_COLUMNS)) throw Error('BNPB DIBI table column count changed');
  return rows;
}

function toCount(cell) {
  const text = cleanText(cell, 12);
  if (text === '') return undefined;
  return Number(text.replace(/[.,]/g, ''));
}

function districtCode(cell) {
  const digits = cleanText(cell, 8);
  if (!/^\d{4}$/.test(digits)) return undefined;
  return upgradeRegionCode(digits.slice(0, 2) + '.' + digits.slice(2));
}

function locationDetail(cell) {
  const text = cleanText(cell.replace(/\\n/g, ' ').replace(/Kecamatan:/gi, ''), 400);
  return text.replace(/\s+/g, ' ').trim();
}

export function eventsFromRows(rows, gazetteer, now, rejections) {
  const events = [];
  for (const cells of rows) {
    const [, , idCell, dateCell, kindCell, locationCell, districtCell, provinceCell, , , deathsCell, missingCell, injuredCell, damagedCell, floodedCell, facilitiesCell] = cells;
    const type = TYPE_BY_EVENT[cleanText(kindCell, 60).toUpperCase()];
    const occurredAt = parseInstant(cleanText(dateCell, 20) + 'T00:00:00Z');
    if (!type) { rejections.add('unknown-event-type'); continue; }
    if (!occurredAt) { rejections.add('bad-date'); continue; }
    if (now - Date.parse(occurredAt) > MAX_AGE_MS) { rejections.add('too-old'); continue; }
    const code = districtCode(idCell);
    const place = code ? gazetteer.byCode(code) : undefined;
    const district = cleanText(districtCell, 80);
    const province = cleanText(provinceCell, 80);
    const placeName = [district, province].filter(Boolean).join(', ');
    try {
      events.push(makeEvent({
        id: 'bnpb:' + shortHash([code ?? district, occurredAt, type, cleanText(locationCell, 200)].join('|')),
        kind: 'official', source: BNPB.name, type, title: placeName, occurredAt, place: placeName,
        regionCode: place?.code, precision: place?.precision, lon: place?.lon, lat: place?.lat,
        detail: locationDetail(locationCell),
        impact: { deaths: toCount(deathsCell), missing: toCount(missingCell), injured: toCount(injuredCell), housesDamaged: toCount(damagedCell), housesFlooded: toCount(floodedCell), facilitiesDamaged: toCount(facilitiesCell) }
      }));
    } catch (error) {
      rejections.add(error.message);
    }
  }
  return events;
}

export async function collectBnpb({ gazetteer, now }) {
  const rejections = new RejectionCounter();
  const rows = parseTable(await fetchText(BNPB.url, { maxBytes: 3_000_000 }));
  const events = eventsFromRows(rows, gazetteer, now, rejections);
  return { events, fetched: rows.length, rejected: rejections.toObject(), warnings: [] };
}
