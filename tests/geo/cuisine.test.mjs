import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const json = async path => JSON.parse(await readFile(path,'utf8'));
const base='static/data/cuisine/';
const locales=['en','id','ms','fil','th','vi','my','km','lo','zh-SG','ta','tet','pt-TL'];
test('starter recipe catalog is internally consistent',async()=>{
  const index=await json(base+'index.json');
  const national=await json(base+'national.json');
  assert.equal(index.schemaVersion,1);
  assert.equal(national.schemaVersion,1);
  assert.equal(national.items.length,index.totals.dishes);
  assert.equal(new Set(national.items.map(x=>x.id)).size,national.items.length);
  assert.equal(national.items.filter(x=>x.recipe).length,index.totals.withRecipe);
  assert.equal(national.items.filter(x=>x.image).length,index.totals.withImage);
  for(const item of national.items){
    assert.ok(item.name&&item.provinceCodes?.length, 'item has a listed province');
    assert.ok(item.sources?.length, 'item keeps provenance');
    assert.ok(item.recipe?.ingredients.length && item.recipe?.steps.length);
    assert.equal(item.recipe.language,'id');
    assert.ok(item.image?.url.startsWith('https://commons.wikimedia.org/wiki/Special:FilePath/'));
    assert.ok(item.image?.descriptionUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
    assert.match(item.image.license,/^CC BY/);
    assert.ok(item.image.credit);
  }
  for(const region of index.provinces){
    assert.match(region.shard,/^\/data\/cuisine\/provinces\/\d{2}\.json$/);
    const shard=await json('static'+region.shard);
    assert.equal(shard.provinceCode,region.provinceCode);
    assert.equal(shard.items.length,region.count);
    assert.ok(shard.items.every(item=>item.provinceCodes.includes(region.provinceCode)));
  }
});
test('cuisine explorer copy is present in all thirteen Paraglide locales',async()=>{
  const keys=['layer_cuisine','cuisine_heading','cuisine_description','cuisine_search','cuisine_choose_province',
    'cuisine_empty','cuisine_no_image','cuisine_minutes','cuisine_recipe','cuisine_no_recipe',
    'cuisine_id_fallback','cuisine_machine_notice','cuisine_ingredients','cuisine_steps',
    'cuisine_recipe_source','cuisine_more','cuisine_scope_notice'];
  for(const locale of locales){
    const messages=await json('messages/'+locale+'.json');
    for(const key of keys)assert.ok(typeof messages[key]==='string' && messages[key].trim(),locale+': '+key);
  }
});
