import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { islandGroupOf, ISLAND_GROUPS } from '../../src/lib/atlas/islands.ts';

test('every 2025 province belongs to exactly one known island group', async () => {
  const provinces = JSON.parse(await readFile('static/data/admin-2025/provinces.json', 'utf8')).regions;
  assert.equal(provinces.length, 38);
  const counts = Object.fromEntries(ISLAND_GROUPS.map(group => [group, 0]));
  for (const province of provinces) counts[islandGroupOf(province.code)] += 1;
  assert.deepEqual(counts, { sumatra: 10, java: 6, 'nusa-tenggara': 3, kalimantan: 5, sulawesi: 6, maluku: 2, papua: 6 });
});

test('geometry package covers every 2025 province and city/regency with matching codes', async () => {
  const provinces = JSON.parse(await readFile('static/data/admin-2025/provinces.json', 'utf8')).regions;
  const national = JSON.parse(await readFile('static/data/geometry-2025/national.json', 'utf8'));
  assert.equal(national.codeEdition, 'Kepmendagri 300.2.2-2430/2025');
  assert.deepEqual(national.regions.map(region => region.sourceCode).sort(), provinces.map(province => province.code).sort());
  let cityCount = 0;
  for (const province of provinces) {
    const cities = JSON.parse(await readFile(`static/data/admin-2025/cities/${province.code}.json`, 'utf8')).regions;
    const geometry = JSON.parse(await readFile(`static/data/geometry-2025/provinces/${province.code}.json`, 'utf8'));
    assert.deepEqual(geometry.regions.map(region => region.sourceCode).sort(), cities.map(city => city.code).sort(), province.code);
    cityCount += geometry.regions.length;
  }
  assert.equal(cityCount, 514);
});
