/**
 * Offline enrichment of the already published cuisine catalog.
 *
 * Unlike build.mjs, this does not re-crawl Cookpad or regenerate recipes/photos.
 * It uses the same sourced regional associations and preserves all prior records.
 * Safe to run whenever scripts/recipes/regional-evidence.json changes.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { classifyDish } from './classify.mjs';
import { isCuisineCatalog, isCuisineDish, isCuisineIndex } from '../../src/lib/data/cuisine-validation.js';

const root = 'static/data/cuisine';
const indexPath = root + '/index.json';
const nationalPath = root + '/national.json';
const evidencePath = 'scripts/recipes/regional-evidence.json';
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const normalize = name => String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = new Map(Object.entries({
  'rendang sapi': 'rendang', 'rawon daging sapi': 'rawon', 'pempek palembang': 'pempek',
  'soto ayam banjar': 'soto banjar', 'papeda kuah kuning': 'papeda'
}));
const key = name => aliases.get(normalize(name)) ?? normalize(name);
const slug = name => normalize(name).replace(/\s+/g, '-').slice(0, 90);
const richness = dish => (dish.recipes?.length ?? 0) * 4 + (dish.images?.length ?? 0) * 2 + (dish.summary ? 1 : 0);
const rank = (a, b) => richness(b) - richness(a) || a.name.localeCompare(b.name, 'id');
const countWith = (items, field) => items.filter(item => Boolean(item[field])).length;

const [index, national, evidence] = await Promise.all([readJson(indexPath), readJson(nationalPath), readJson(evidencePath)]);
if (!isCuisineIndex(index) || !isCuisineCatalog(national)) throw Error('Existing cuisine catalog is invalid');
const validCodes = new Set(index.provinces.map(item => item.provinceCode));
const byName = new Map(national.dishes.map(item => [key(item.name), item]));
const ids = new Set(national.dishes.map(item => item.id));
let added = 0, linked = 0;

for (const [code, groups] of Object.entries(evidence)) {
  if (!validCodes.has(code) || !Array.isArray(groups)) throw Error('Unknown cuisine province: ' + code);
  for (const group of groups) {
    if (!group || !Array.isArray(group.dishes) || !/^https:\/\/[^/]+/.test(group.source))
      throw Error('Invalid regional reference for ' + code);
    for (const name of group.dishes) {
      if (typeof name !== 'string' || !name.trim() || name.length > 160)
        throw Error('Invalid cuisine name in ' + code);
      let dish = byName.get(key(name));
      if (!dish) {
        const id = slug(name);
        if (!id || ids.has(id)) throw Error('Duplicate or invalid cuisine ID: ' + id);
        dish = { id, name, group: classifyDish(name), provinceCodes: [], originStatus: 'regional-source', summary: '', sources: [] };
        byName.set(key(name), dish);
        national.dishes.push(dish);
        ids.add(id);
        added++;
      } else {
        linked++;
        if (dish.originStatus === 'unmapped') dish.originStatus = 'regional-source';
      }
      if (!dish.provinceCodes.includes(code)) dish.provinceCodes.push(code);
      dish.provinceCodes.sort();
      if (!dish.sources.some(source => source.url === group.source && source.role === 'regional-reference'))
        dish.sources.push({ url: group.source, role: 'regional-reference' });
    }
  }
}

national.dishes.sort(rank);
const dishes = national.dishes;
const nextIndex = {
  ...index,
  scope: 'Indonesian dishes from the Wikipedia regional list and separately sourced provincial culinary references, with recipes where available from Cookpad and LorthGyu. Associations do not prove exclusive origin. A missing recipe, image or dish is not evidence of absence.',
  attribution: 'Indonesian Wikipedia contributors; regional culinary publications (linked per dish); Cookpad Indonesia recipe authors; LorthGyu (MIT); Wikimedia Commons photographers (per file).',
  license: 'Wikipedia summaries: CC BY-SA 4.0; regional dish associations are linked to their original reference pages. Recipes retain their author attribution and source links. Photos are linked, never copied, with per-file credit and licence.',
  sources: [...index.sources.filter(source => source.name !== 'Regional culinary references'),
    { name: 'Regional culinary references', url: 'https://www.indonesia.travel/id/id' }],
  coverage: {
    totalDishes: dishes.length, withoutProvince: dishes.filter(item => item.provinceCodes.length === 0).length,
    withRecipe: countWith(dishes, 'recipes'), withImage: countWith(dishes, 'images'),
    withSummary: countWith(dishes, 'summary'), recipes: dishes.reduce((n, item) => n + (item.recipes?.length ?? 0), 0)
  },
  groupCounts: {},
  provinces: index.provinces.map(province => {
    const items = dishes.filter(dish => dish.provinceCodes.includes(province.provinceCode));
    return { ...province, count: items.length, withRecipe: countWith(items, 'recipes'), withImage: countWith(items, 'images') };
  })
};
for (const dish of dishes) nextIndex.groupCounts[dish.group] = (nextIndex.groupCounts[dish.group] ?? 0) + 1;
if (!isCuisineIndex(nextIndex) || !isCuisineCatalog(national) || dishes.some(dish => !isCuisineDish(dish)))
  throw Error('Regional enrichment produced invalid cuisine records');
for (const province of nextIndex.provinces) {
  const items = dishes.filter(dish => dish.provinceCodes.includes(province.provinceCode));
  const shard = { schemaVersion: 2, fetchedAt: national.fetchedAt, provinceCode: province.provinceCode, dishes: items };
  if (!isCuisineCatalog(shard)) throw Error('Invalid province catalog: ' + province.provinceCode);
}
for (const province of nextIndex.provinces) {
  const shard = { schemaVersion: 2, fetchedAt: national.fetchedAt, provinceCode: province.provinceCode,
    dishes: dishes.filter(dish => dish.provinceCodes.includes(province.provinceCode)) };
  await writeFile(root + '/provinces/' + province.provinceCode + '.json', JSON.stringify(shard) + '\n');
}
await writeFile(indexPath, JSON.stringify(nextIndex, null, 2) + '\n');
await writeFile(nationalPath, JSON.stringify(national) + '\n');
console.log('Enriched cuisine: ' + added + ' added, ' + linked + ' linked to further provinces; ' +
  nextIndex.coverage.totalDishes + ' dishes across 38 province shards.');
