import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const i = process.argv.indexOf('--input');
if (i < 0 || !process.argv[i + 1]) throw Error('Usage: npm run import:regions -- --input /path/to/wilayah_2023.sql');
const sql = await readFile(resolve(process.argv[i + 1]), 'utf8');
if (!sql.includes('100.1.1-6117 Tahun 2022')) throw Error('Wrong Kemendagri source edition');
const entry = /\('(\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?)','((?:[^'\\]|\\.|'')*)'\)/g;
const rows = [], codes = new Set();
for (const m of sql.matchAll(entry)) {
  const code = m[1];
  if (codes.has(code)) throw Error('Duplicate: ' + code);
  codes.add(code);
  const parts = code.split('.');
  rows.push({
    code,
    name: m[2].replaceAll("''", "'").replaceAll("\\'", "'"),
    level: ['province','city-regency','district','village'][parts.length - 1],
    parentCode: parts.length === 1 ? null : parts.slice(0,-1).join('.')
  });
}
const provinces = rows.filter(r=>r.level==='province');
const cities = rows.filter(r=>r.level==='city-regency');
const districts = rows.filter(r=>r.level==='district');
const villages = rows.filter(r=>r.level==='village');
if (provinces.length !== 37 || cities.length !== 514) throw Error('Expected 37 provinces and 514 city/regencies for 2022 edition, got '+provinces.length+'/'+cities.length);
for (const row of rows) if(row.parentCode && !codes.has(row.parentCode)) throw Error('Missing parent for '+row.code);
const dir=resolve('static/data/admin-2022'), edition='Kepmendagri 100.1.1-6117/2022';
const sourceSha256=createHash('sha256').update(sql).digest('hex');
const save=(name,data)=>writeFile(resolve(dir,name),JSON.stringify(data));
await mkdir(resolve(dir,'regions'),{recursive:true});
await save('provinces.json',{edition,sourceSha256,count:provinces.length,regions:provinces});
await save('cities.json',{edition,sourceSha256,count:cities.length,regions:cities});
await save('districts.json',{edition,sourceSha256,count:districts.length,regions:districts});
for(const p of provinces) {
 const regions=rows.filter(r=>r.code.startsWith(p.code+'.'));
 await save('regions/'+p.code+'.json',{edition,sourceSha256,provinceCode:p.code,count:regions.length,regions});
}
await save('manifest.json',{edition,sourceSha256,counts:{provinces:provinces.length,cities:cities.length,districts:districts.length,villages:villages.length},generatedAt:new Date().toISOString()});
console.log('Imported 2022 hierarchy',provinces.length,cities.length,districts.length,villages.length,sourceSha256);
