import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  appendProgress, isFinished, loadProgress, parseCsvRecords, selectWebImageUrls
} from '../../scripts/destinations/google-image-progress.mjs';
import { remainingDestinations, readImageResultsExpression, duckDuckGoThumbnailUrl, bingThumbnailUrl, simplifySearchQuery } from '../../scripts/destinations/scrape-google-images.mjs';
import { applyWebImagesToLandmarks } from '../../scripts/destinations/apply-google-images.mjs';
import { isDestinationRecord } from '../../src/lib/data/destination-validation.js';

const CSV = 'destination_id,province_code,destination_name,search_query\n'
  + '"sisparnas-1","11","Pantai, Indah","Pantai, Indah ""Aceh"""\n'
  + '"sisparnas-2","11","B","B q"\r\n'
  + '"sisparnas-10","12","C","C q"\n';

test('CSV parser keeps commas, doubled quotes and CRLF rows', () => {
  const rows = parseCsvRecords(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].destination_name, 'Pantai, Indah');
  assert.equal(rows[0].search_query, 'Pantai, Indah "Aceh"');
  assert.equal(rows[1].search_query, 'B q');
});

test('CSV parser strips a UTF-8 byte order mark from the first header', () => {
  const rows = parseCsvRecords('\uFEFFdestination_id,x\n"a","b"\n');
  assert.deepEqual(Object.keys(rows[0]), ['destination_id', 'x']);
});

test('only plain https URLs are kept, deduplicated and capped at 8', () => {
  const sources = ['data:image/png;base64,AAA', 'http://x/1', 'https://x/1', 'https://x/1',
    ...Array.from({ length: 12 }, (_, index) => 'https://x/n' + index)];
  assert.deepEqual(selectWebImageUrls(sources), ['https://x/1', ...Array.from({ length: 7 }, (_, index) => 'https://x/n' + index)]);
});

test('progress survives a torn last line and resumes where it stopped', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'google-images-'));
  try {
    const file = path.join(directory, 'progress.jsonl');
    await appendProgress(file, { destinationId: 'sisparnas-1', status: 'ok', images: ['https://x/a'] });
    await appendProgress(file, { destinationId: 'sisparnas-2', status: 'empty', images: [] });
    await appendFile(file, '{"destinationId":"sisparnas-10","sta');
    const progress = await loadProgress(file);
    assert.equal(progress.size, 2);
    const rows = parseCsvRecords(CSV);
    assert.deepEqual(remainingDestinations(rows, progress, {}).map(row => row.destination_id), ['sisparnas-10']);
    assert.deepEqual(remainingDestinations(rows, progress, { retryEmpty: true }).map(row => row.destination_id),
      ['sisparnas-2', 'sisparnas-10']);
    assert.deepEqual(remainingDestinations(rows, new Map(), { province: '12' }).map(row => row.destination_id), ['sisparnas-10']);
    assert.deepEqual(remainingDestinations(rows, new Map(), { after: 'sisparnas-2', limit: 5 }).map(row => row.destination_id), ['sisparnas-10']);
    assert.equal(isFinished(progress.get('sisparnas-2')), true);
    assert.equal((await loadProgress(path.join(directory, 'missing.jsonl'))).size, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('webImages are applied only without a licensed image and pass the record contract', () => {
  const progress = new Map([
    ['a', { destinationId: 'a', status: 'ok', images: ['https://x/a1', 'https://x/a2'] }],
    ['b', { destinationId: 'b', status: 'ok', images: ['https://x/b1'] }],
    ['c', { destinationId: 'c', status: 'empty', images: [] }]
  ]);
  const base = { provinceCode: '11', kind: 'unknown' };
  const landmarks = [
    { ...base, id: 'a', name: 'A' },
    { ...base, id: 'b', name: 'B', webImages: ['https://x/stale'], image: {} },
    { ...base, id: 'c', name: 'C' }
  ];
  assert.equal(applyWebImagesToLandmarks(landmarks, progress), 2);
  assert.deepEqual(landmarks[0].webImages, ['https://x/a1', 'https://x/a2']);
  assert.equal('webImages' in landmarks[1], false);
  assert.equal('webImages' in landmarks[2], false);
  assert.equal(applyWebImagesToLandmarks(landmarks, progress), 0);
  assert.equal(isDestinationRecord(landmarks[0]), true);
  assert.equal(isDestinationRecord({ ...landmarks[0], webImages: ['http://x/insecure'] }), false);
  assert.equal(isDestinationRecord({ ...landmarks[0], webImages: [] }), false);
});

test('in-page expression embeds the agreed IMAGE_RESULTS xpath', () => {
  assert.match(readImageResultsExpression(), /data-img-wrapper/);
});

test('DuckDuckGo proxy URLs unwrap to the same stable Bing thumbnail as the Bing engine', () => {
  const proxied = 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse3.mm.bing.net%2Fth%2Fid%2FOIP.aPSYoQrpkWFthRdz1uZX8AHaE8%3Fr%3D0%26pid%3DApi&f=1&ipt=abc';
  assert.equal(duckDuckGoThumbnailUrl(proxied), 'https://th.bing.com/th/id/OIP.aPSYoQrpkWFthRdz1uZX8AHaE8');
  assert.equal(bingThumbnailUrl('https://ts4.mm.bing.net/th?id=OIP.aPSYoQrpkWFthRdz1uZX8AHaE8&pid=15.1'),
    'https://th.bing.com/th/id/OIP.aPSYoQrpkWFthRdz1uZX8AHaE8');
  assert.equal(duckDuckGoThumbnailUrl('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fexample.com%2Fa.jpg&f=1'),
    'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fexample.com%2Fa.jpg&f=1');
  assert.equal(duckDuckGoThumbnailUrl('https://evil.example/iu/?u=https%3A%2F%2Fexample.com%2Fa.jpg'), undefined);
  assert.equal(duckDuckGoThumbnailUrl('not a url'), undefined);
});

test('long address-style names are shortened to a searchable query', () => {
  const row = {
    destination_name: 'PEDATI KUNO Kalianyar -Krangkeng (Desa Wisata Sejarah, Kalianyar Krangkeng - Indramayu, Jawa-Barat)',
    district: 'Kabupaten Indramayu', province: 'Jawa Barat'
  };
  assert.equal(simplifySearchQuery(row), 'PEDATI KUNO Kalianyar Krangkeng Kabupaten Indramayu Jawa Barat Indonesia');
  assert.equal(simplifySearchQuery({ destination_name: 'Pantai Naibos', district: '', province: 'Aceh' }), 'Pantai Naibos Aceh Indonesia');
  assert.equal(simplifySearchQuery({ destination_name: 'a b c d e f g h', district: 'D', province: 'P' }), 'a b c d e f D P Indonesia');
});
