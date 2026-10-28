import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseWikiIndex, mergeCatalog, matchWikiRecipe, normalizeName, LOCALES, PROVINCES, catalogSummary } from '../../scripts/cuisine/catalog.mjs';

const sample=String.raw`== Makanan ==
=== Aceh ===
* [[Mie Aceh]]
* [[Sate Padang]]
=== Sumatera Barat ===
* [[Sate Padang]]
* [[Rendang]]
=== Papua Selatan ===
* Papeda
=== Referensi ===
* [[Not a dish]]
== Referensi ==
* [[Also not a dish]]
`;
test('parses provincial headings and shared foods without inventing coordinates', () => {
  const records=parseWikiIndex(sample);
  assert.equal(records.length,4);
  assert.deepEqual(records.find(x=>x.name==='Sate Padang')?.provinceCodes,['11','13']);
  assert.deepEqual(records.find(x=>x.name==='Papeda')?.provinceCodes,['93']);
  assert.equal(records.some(x=>x.name.includes('not a dish')),false);
});
test('merges full recipes with province mentions, preserves unmatched unassigned recipes', () => {
  const records=mergeCatalog(parseWikiIndex(sample),[
    {name:'Mie Aceh',category:'makanan_utama',ingredients:['mie kuning','bawang putih'],steps:['Rebus mie hingga empuk','Tumis bawang lalu aduk mie'],region:'Sumatera',time_minutes:30,difficulty:'mudah'},
    {name:'Rendang Sapi',category:'makanan_utama',ingredients:['daging sapi','santan'],steps:['Rebus bersama santan','Masak sampai kering'],region:'Sumatera'},
    {name:'Sayur Baru',category:'makanan_utama',ingredients:['sayuran','air'],steps:['Cuci sayur','Rebus dengan air'],region:'Jawa'}
  ]);
  assert.deepEqual(records.find(x=>x.name==='Mie Aceh')?.provinceCodes,['11']);
  assert.deepEqual(records.find(x=>x.name==='Sayur Baru')?.provinceCodes,[]);
  assert.equal(records.find(x=>x.name==='Mie Aceh')?.recipe?.language,'id');
  assert.ok(records.find(x=>x.name==='Mie Aceh')?.sourceUrls.length===2);
  assert.equal(catalogSummary(records).recipes,3);
  assert.equal(records.find(x=>x.name==='Papeda')?.recipe,null);
});
test('does not fuzzy-match generic dishes to unreliable origin',()=>{
  assert.equal(matchWikiRecipe('Sate Ayam',parseWikiIndex(sample)),undefined);
  assert.equal(normalizeName('Mié   Aceh!'),'mié aceh');
});
test('all 13 Paraglide locales have complete cuisine messages',async()=>{
  const translations=new Set(LOCALES);
  assert.equal(translations.size,13);
  const files=await Promise.all(LOCALES.map(async locale=>JSON.parse(await readFile('messages/'+locale+'.json','utf8'))));
  const keys=Object.keys(files[0]).filter(k=>k.startsWith('cuisine_')||k==='layer_cuisine').sort();
  assert.ok(keys.length>=20);
  files.forEach((messages,index)=>{
    assert.deepEqual(keys,Object.keys(messages).filter(k=>k.startsWith('cuisine_')||k==='layer_cuisine').sort(),LOCALES[index]);
    keys.forEach(key=>assert.ok(messages[key]?.trim(),LOCALES[index]+' '+key));
  });
  assert.equal(new Set([...PROVINCES.values()]).size,38);
});
test('seed snapshot validates regional and recipe content',async()=>{
  const snapshot=JSON.parse(await readFile('static/data/cuisine/catalog.json','utf8'));
  assert.equal(snapshot.schemaVersion,1);
  assert.ok(snapshot.dishes.length>0);
  for(const dish of snapshot.dishes){
    assert.ok(dish.name);
    assert.ok(Array.isArray(dish.provinceCodes));
    assert.ok(dish.provinceCodes.every(x=>/^\d{2}$/.test(x)));
    if(dish.recipe){
      assert.ok(dish.recipe.ingredients.length>=2);
      assert.ok(dish.recipe.steps.length>=2);
    }
  }
});
