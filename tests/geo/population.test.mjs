import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isPopulationData, provinceSeries, provinceYear, pyramidRows, yearTotals } from '../../src/lib/data/population-contract.ts';

const shipped = JSON.parse(await readFile('static/data/observations/population.json', 'utf8'));

test('shipped population file passes the contract and keeps a five-year yearly window', () => {
  assert.equal(isPopulationData(shipped), true);
  assert.deepEqual(shipped.years.map(entry => entry.year), [2022, 2023, 2024, 2025, 2026]);
  assert.equal(shipped.ageGroups.length, 16);
});

test('2026 total matches BPS mid-year population table 1975 (287,198.383 thousand)', () => {
  const latest = yearTotals(shipped).at(-1);
  assert.equal(latest.year, 2026);
  assert.ok(Math.abs(latest.total - 287198.383) < 0.1);
});

test('pyramid rows pair age groups with male and female values; unknown year is empty', () => {
  const rows = pyramidRows(shipped, 2026);
  assert.equal(rows.length, 16);
  assert.deepEqual(rows[0], { ageGroup: '0-4', male: 11544, female: 11086.8 });
  assert.deepEqual(pyramidRows(shipped, 1999), []);
});

test('year totals report change versus the previous year only after the first year', () => {
  const totals = yearTotals(shipped);
  assert.equal(totals[0].change, undefined);
  assert.ok(Math.abs(totals[1].change - (totals[1].total - totals[0].total)) < 1e-9);
  assert.ok(totals.slice(1).every(item => item.change > 0 && item.changePercent > 0));
});

test('province values add up to the national total in every year and use atlas codes', () => {
  assert.equal(shipped.provinces.length, 38);
  for (const entry of shipped.years) {
    const total = shipped.provinces.reduce((sum, province) => sum + (province.years.find(item => item.year === entry.year)?.population ?? 0), 0);
    assert.ok(Math.abs(total - entry.published.total) <= 1, String(entry.year));
  }
  const names = Object.fromEntries(shipped.provinces.map(province => [province.code, province.name]));
  assert.deepEqual([names['91'], names['92'], names['93'], names['94'], names['95'], names['96']],
    ['Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya']);
});

test('province series hides years that describe an older boundary', () => {
  assert.deepEqual(provinceSeries(shipped, '32').map(item => item.year), [2022, 2023, 2024, 2025, 2026]);
  assert.deepEqual(provinceSeries(shipped, '91').map(item => item.year), [2024, 2025, 2026]);
  assert.equal(provinceYear(shipped, '91', 2023), undefined);
  assert.equal(provinceYear(shipped, '32', 2026).population, 51163.9);
  assert.deepEqual(provinceSeries(shipped, '00'), []);
});

for (const [name, change] of [
  ['a province total that no longer matches the national total', data => { data.provinces[0].years[0].population += 500; }],
  ['a duplicate province code', data => { data.provinces[1].code = data.provinces[0].code; }],
  ['a province year outside the file', data => { data.provinces[0].years[0].year = 1990; }],

  ['an unknown kind', data => { data.kind = 'other'; }],
  ['a non-https source', data => { data.sourceUrl = 'http://example.com'; }],
  ['a row with the wrong length', data => { data.years[0].male.pop(); }],
  ['a negative value', data => { data.years[0].female[0] = -1; }],
  ['a total that does not add up', data => { data.years[0].published.total += 500; }],
  ['an age row that drifts from its published total', data => { data.years[2].male[3] += 50; }],
  ['a gap between years', data => { data.years[2].year = 2030; }],
  ['more than five years', data => { data.years.unshift({ ...structuredClone(data.years[0]), year: 2021 }); }]
]) {
  test(`population contract rejects ${name}`, () => {
    const data = structuredClone(shipped);
    change(data);
    assert.equal(isPopulationData(data), false);
  });
}
