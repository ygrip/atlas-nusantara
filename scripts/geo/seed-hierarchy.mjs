import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const edition = 'Kepmendagri 100.1.1-6117/2022';
const directory = resolve('static/data/admin-2022');
const provinces = JSON.parse(await readFile(resolve(directory, 'provinces.json'), 'utf8'));
const cities = JSON.parse(await readFile(resolve(directory, 'cities.json'), 'utf8'));
if (provinces.edition !== edition || cities.edition !== edition || provinces.regions.length !== 37 || cities.regions.length !== 514) throw Error('Expected exact 2022 edition, 37 provinces and 514 cities');
const provinceCodes = new Set(provinces.regions.map(region => region.code));
const codes = new Set();
const sqlValue = value => "'" + value.replaceAll("'", "''") + "'";
const statements = ['-- Generated from the pinned historical 2022 code transcription. Idempotent upserts; no recurring hierarchy crawler.'];
for (const region of [...provinces.regions, ...cities.regions]) {
  if (typeof region.code !== 'string' || !/^\d{2}(\.\d{2})?$/.test(region.code) || codes.has(region.code)) throw Error('Invalid or duplicate region code');
  codes.add(region.code);
  let parent = 'NULL';
  if (region.level === 'city-regency') {
    if (!provinceCodes.has(region.parentCode)) throw Error('Unknown parent: ' + region.code);
    parent = sqlValue(region.parentCode);
  }
  statements.push(`INSERT INTO regions (code,name,level,parent_code,code_edition,boundary_edition,svg_path) VALUES (${sqlValue(region.code)},${sqlValue(region.name)},${sqlValue(region.level)},${parent},${sqlValue(edition)},NULL,NULL) ON CONFLICT(code) DO UPDATE SET name=excluded.name,level=excluded.level,parent_code=excluded.parent_code,code_edition=excluded.code_edition;`);
}
await mkdir('cloudflare/seeds', { recursive: true });
await writeFile('cloudflare/seeds/regions.sql', statements.join('\n') + '\n');
console.log('Generated 551 exact-code hierarchy rows; boundary metadata stays unset until verified geometry is available.');
