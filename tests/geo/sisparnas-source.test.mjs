import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseMarkerResponse, parseProvinceOptions, parseRegionRows, parseSelectedYear,
  crawlSisparnas } from '../../scripts/destinations/crawl-sisparnas.mjs';

const row = (id, name, count, action) => `<tr><td>1</td><td>${name}</td><td>${count}</td><td><a onclick="${action}(${id})">Open</a></td></tr>`;
const response = (data, list) => ({ status: true, section: 'peta', scope: 'dtw', data, list });

test('reads source selectors and preserves source province IDs without interpreting them as pinned codes', () => {
  const html = `<select id="tahun"><option value="2025">2025</option><option value="2026" selected>2026</option></select>
    <select id="idprov"><option value="0">All</option><option value="91">Papua Barat</option><option value="92">Papua</option></select>`;
  assert.equal(parseSelectedYear(html), '2026');
  assert.deepEqual(parseProvinceOptions(html), [{ id: '91', name: 'Papua Barat' }, { id: '92', name: 'Papua' }]);
  assert.deepEqual(parseRegionRows(row(1101, 'Kabupaten Simeulue', '1,234', 'loadKota'), 'loadKota'),
    [{ id: '1101', name: 'Kabupaten Simeulue', count: 1234 }]);
});

test('keeps factual markers but excludes popup prose and unlicensed photo URLs', () => {
  const payload = response([{ id: 1, title: 'Source place', lat: '2.5', lng: '96.2',
    text: 'Do not republish this description', icon: 'https://example.org/photo.jpg' }], '');
  assert.deepEqual(parseMarkerResponse(JSON.stringify(payload)), [{ id: '1', name: 'Source place', lat: '2.5', lng: '96.2' }]);
  assert.throws(() => parseMarkerResponse('<html>Login required</html>'), /non-JSON/);
});

test('refresh crawl retains count discrepancies and resumes from cached factual responses', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'nusantara-sisparnas-'));
  let posts = 0;
  const options = Array.from({ length: 38 }, (_, index) => ({ id: String(index + 11), name: 'Source province ' + index }));
  const page = `<select id="tahun"><option value="2026" selected>2026</option></select><select id="idprov">`
    + options.map(item => `<option value="${item.id}">${item.name}</option>`).join('') + '</select>';
  const fetcher = async (url, request) => {
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
    if (!request.method) return new Response(page);
    posts++;
    const fields = new URLSearchParams(request.body);
    const provinceId = fields.get('idprov');
    const districtId = fields.get('idkota');
    if (provinceId === '0') return Response.json(response([], '<table>' + options.map(item => row(item.id, item.name, 2, 'loadProv')).join('') + '</table>'));
    if (districtId === '0') return Response.json(response([], '<table>' + row(Number(provinceId) * 100, 'Source district', 1, 'loadKota') + '</table>'));
    return Response.json(response([{ id: districtId, title: 'Place ' + districtId, lat: '0', lng: '0' }], ''));
  };
  try {
    const first = await crawlSisparnas({ outputDirectory, delayMs: 0, fetcher });
    const before = posts;
    const second = await crawlSisparnas({ outputDirectory, delayMs: 0, fetcher });
    const saved = JSON.parse(await readFile(path.join(outputDirectory, 'inventory.json'), 'utf8'));
    assert.equal(first.uniqueIds, 38);
    assert.equal(first.nationalAggregateReported, 76);
    assert.equal(first.complete, false);
    assert.equal(first.provinceMismatches.length, 38);
    assert.equal(second.fetchedAt, first.fetchedAt);
    assert.equal(posts, before);
    assert.equal(saved.factualRecords.length, 38);
    assert.equal(saved.factualRecords[0].sourceCategory, undefined);
    assert.ok(saved.factualRecords[0].retrievedAt);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
