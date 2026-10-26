import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const atlasOnly = process.argv.includes('--atlas-only');
const i = process.argv.indexOf('--input');
if (i < 0 || !process.argv[i + 1]) throw Error('Usage: npm run import:regions -- --input /path/to/wilayah.sql');
// Pinned transcription: github.com/cahyadsn/wilayah db/wilayah.sql @ d68e8d5516 (MIT), following
// Kepmendagri 300.2.2-2430/2025 per the repository README (the file header still names 300.2.2-2138/2025).
const PINNED_SOURCE_SHA256 = 'c4c3396d9380d4edee072af1d9dff83573b574d7cd00a6562cf82e200e954031';
const sql = await readFile(resolve(process.argv[i + 1]), 'utf8');
if (createHash('sha256').update(sql).digest('hex') !== PINNED_SOURCE_SHA256) throw Error('Unpinned Kemendagri source transcription');
const entry = /\('(\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?)','((?:[^'\\]|\\.|'')*)'\)/g;
const rows = [], codes = new Set();
for (const m of sql.matchAll(entry)) {
  const code = m[1];
  if (codes.has(code)) throw Error('Duplicate: ' + code);
  codes.add(code);
  const parts = code.split('.');
  let parentCode = null;
  if (parts.length > 1) parentCode = parts.slice(0, -1).join('.');
  rows.push({
    code,
    name: m[2].replaceAll("''", "'").replaceAll("\\'", "'"),
    level: ['province','city-regency','district','village'][parts.length - 1],
    parentCode
  });
}
const provinces = rows.filter(r=>r.level==='province');
const cities = rows.filter(r=>r.level==='city-regency');
const districts = rows.filter(r=>r.level==='district');
const villages = rows.filter(r=>r.level==='village');
if (provinces.length !== 38 || cities.length !== 514) throw Error('Expected 38 provinces and 514 city/regencies for the 2025 edition, got '+provinces.length+'/'+cities.length);
for (const row of rows) if(row.parentCode && !codes.has(row.parentCode)) throw Error('Missing parent for '+row.code);
const dir=resolve('static/data/admin-2025'), edition='Kepmendagri 300.2.2-2430/2025';
const sourceSha256=createHash('sha256').update(sql).digest('hex');
const save=(name,data)=>writeFile(resolve(dir,name),JSON.stringify(data));
if (!atlasOnly) await mkdir(resolve(dir,'regions'),{recursive:true});
await mkdir(resolve(dir,'cities'),{recursive:true});
await save('provinces.json',{edition,sourceSha256,count:provinces.length,regions:provinces});
await save('cities.json',{edition,sourceSha256,count:cities.length,regions:cities});
if (!atlasOnly) await save('districts.json',{edition,sourceSha256,count:districts.length,regions:districts});
for(const p of provinces) {
 await save('cities/'+p.code+'.json',{edition,sourceSha256,provinceCode:p.code,regions:cities.filter(r=>r.parentCode===p.code)});
 if (!atlasOnly) {
  const regions=rows.filter(r=>r.code.startsWith(p.code+'.'));
  await save('regions/'+p.code+'.json',{edition,sourceSha256,provinceCode:p.code,count:regions.length,regions});
 }
}
await save('manifest.json',{edition,sourceSha256,counts:{provinces:provinces.length,cities:cities.length,districts:districts.length,villages:villages.length},generatedAt:new Date().toISOString()});
console.log('Imported 2025 hierarchy',provinces.length,cities.length,districts.length,villages.length,sourceSha256);
