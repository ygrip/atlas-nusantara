import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml, exportFileName, serializeDataset, toCsv, toJson, toXml } from '../../src/lib/export/map-export.ts';
import { pinDataset, regionDataset } from '../../src/lib/export/build-dataset.ts';

const dataset = {
  layer: 'mountains', title: 'Mountains', scope: 'Indonesia', generatedAt: '2025-01-31T10:00:00.000Z', source: 'BIG', dataTime: '2025-01-30T00:00:00Z',
  columns: [{ id: 'name' }, { id: 'latitude' }, { id: 'note' }],
  rows: [
    { name: 'Gunung "Agung", Bali', latitude: -8.34, note: null },
    { name: '=HYPERLINK("x")', latitude: 1, note: 'line\nbreak' }
  ]
};

test('csv quotes cells, neutralises formulas and keeps numbers numeric', () => {
  const lines = toCsv(dataset).replace('\uFEFF', '').split('\r\n');
  assert.equal(lines[0], 'name,latitude,note');
  assert.equal(lines[1], '"Gunung ""Agung"", Bali",-8.34,');
  assert.equal(lines[2], '"\'=HYPERLINK(""x"")",1,"line\nbreak"');
  assert.ok(toCsv(dataset).startsWith('\uFEFF'));
});

test('json carries metadata and one record per row with every column', () => {
  const parsed = JSON.parse(toJson(dataset));
  assert.equal(parsed.metadata.record_count, 2);
  assert.equal(parsed.metadata.source, 'BIG');
  assert.deepEqual(Object.keys(parsed.records[0]), ['name', 'latitude', 'note']);
  assert.equal(parsed.records[0].note, null);
});

test('xml escapes markup, drops illegal characters and marks null cells', () => {
  assert.equal(escapeXml('a<b>&"\'\u0001c'), 'a&lt;b&gt;&amp;&quot;&apos;c');
  const xml = toXml(dataset);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<records count="2">'));
  assert.ok(xml.includes('<name>Gunung &quot;Agung&quot;, Bali</name>'));
  assert.ok(xml.includes('<note nil="true"/>'));
});

test('invalid column ids are rejected before any file is written', () => {
  const bad = { ...dataset, columns: [{ id: 'Bad Name' }] };
  for (const format of ['json', 'csv', 'xml']) assert.throws(() => serializeDataset(bad, format), /Invalid export column id/);
});

for (const [format, name, type] of [['json', 'nusantara-mountains-indonesia-20250131.json', 'application/json'], ['csv', 'nusantara-mountains-indonesia-20250131.csv', 'text/csv'], ['xml', 'nusantara-mountains-indonesia-20250131.xml', 'application/xml']]) {
  test(`${format} file name and mime type`, () => {
    assert.equal(exportFileName(dataset, format), name);
    assert.equal(serializeDataset(dataset, format).mimeType, type);
  });
}

test('file names are ASCII slugs of the scope', () => {
  assert.equal(exportFileName({ ...dataset, scope: 'Daerah Khusus Ibukota Jakarta' }, 'csv'), 'nusantara-mountains-daerah-khusus-ibukota-jakarta-20250131.csv');
});

test('region dataset adds forecast columns only when a forecast is present', () => {
  const regions = [{ code: '11', name: 'Aceh', level: 'province' }];
  const base = { layer: 'warning', title: 'Weather', scope: 'Indonesia', generatedAt: dataset.generatedAt, regions, coordinates: () => ({ lat: 4.123456789, lon: 96.5 }) };
  const plain = regionDataset(base);
  assert.deepEqual(plain.columns.map(column => column.id), ['code', 'name', 'level', 'parent_code', 'parent_name', 'latitude', 'longitude']);
  assert.equal(plain.rows[0].latitude, 4.12346);
  const step = { at: 'T', t: 28, hu: 80, tcc: 40, tp: 0, weather: 1, desc: 'Cerah', wd: 90, ws: 10 };
  const forecast = { source: 'BMKG', sourceUrl: 'https://api.bmkg.go.id', attribution: 'BMKG', fetchedAt: 'F', points: [{ code: '11.01', adm4: 'x', lon: 95, lat: 5, steps: [step] }] };
  const weather = regionDataset({ ...base, forecast, forecastTime: 'T' });
  assert.equal(weather.rows[0].weather, 'Cerah');
  assert.equal(weather.rows[0].temperature_c, 28);
  assert.equal(weather.source, 'BMKG');
});

test('pin dataset exports every pin with the overlay source', () => {
  const overlay = { id: 'earthquake', color: '#cf482b', symbol: 'circle', source: 'BMKG', sourceUrl: 'https://example.org', fetchedAt: 'F', legend: [], pins: [{ id: 'a', lon: 100.123456789, lat: -1, label: 'M5.0', value: 5 }] };
  const result = pinDataset(overlay, 'Earthquakes', 'Indonesia', dataset.generatedAt);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].longitude, 100.12346);
  assert.equal(result.rows[0].category, null);
  assert.equal(result.sourceUrl, 'https://example.org');
});
