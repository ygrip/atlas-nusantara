// One representative village per city/regency, with explicit BMKG code differences.
// Usage: node scripts/geo/build-forecast-points.mjs /path/to/pinned/wilayah.sql
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const input = process.argv[2];
if (!input) throw Error('Supply the pinned wilayah.sql transcription');
const sql = await readFile(input, 'utf8');
const cities = JSON.parse(await readFile('static/data/admin-2025/cities.json', 'utf8'));
if (createHash('sha256').update(sql).digest('hex') !== cities.sourceSha256) throw Error('Transcription checksum differs from the city directory');
const firstVillage = new Map();
for (const match of sql.matchAll(/\('(\d{2}\.\d{2}\.\d{2}\.\d{4})',/g)) {
  const code = match[1];
  if (!firstVillage.has(code.slice(0, 5))) firstVillage.set(code.slice(0, 5), code);
}
// Verified against BMKG's returned adm2 and kotkab fields, 2026-10-26.
// BMKG keeps the older regency suffixes when moving these units from province 92 to 96.
const overrides = {
  '96.02': { providerCode: '96.04', adm4: '96.04.01.2004' },
  '96.03': { providerCode: '96.05', adm4: '96.05.01.2001' },
  '96.04': { providerCode: '96.09', adm4: '96.09.01.2001' },
  '96.05': { providerCode: '96.10', adm4: '96.10.01.2001' }
};
const points = cities.regions.map(city => {
  const adm4 = firstVillage.get(city.code);
  if (!adm4) throw Error('No representative village for ' + city.code);
  return { code: city.code, adm4, ...overrides[city.code], expectedName: city.name };
});
await writeFile('static/data/admin-2025/forecast-points.json', JSON.stringify({ edition: cities.edition, method: 'First listed village per city/regency, with explicit BMKG code overrides checked against returned region names.', points }));
console.log('Generated', points.length, 'forecast points');
