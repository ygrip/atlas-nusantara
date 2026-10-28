import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { isCuisineCatalog, isCuisineDish, isCuisineImage, isCuisineIndex, isCuisineRecipe } from '../../src/lib/data/cuisine-validation.js';
import { filterDishes, sortDishes } from '../../src/lib/data/cuisine-table.ts';
import { cuisineImagePage, cuisineImageUrl, isShareableCuisinePhoto } from '../../src/lib/data/cuisine-images.ts';
import { dishKey, extractRecipe, parseSearchResults, titleNamesDish } from '../../scripts/recipes/cookpad-parse.mjs';
import { leadImage, parseCommonsFilePage, trimSummary } from '../../scripts/recipes/wikipedia-parse.mjs';
import { classifyDish, isLikelyDish } from '../../scripts/recipes/classify.mjs';
import { assembleDish } from '../../scripts/recipes/assemble.mjs';

const LOCALES = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const recipe = {
  id: 'cookpad-1', source: 'cookpad', title: 'Soto Banjar', url: 'https://cookpad.com/id/resep/1', author: 'Ani',
  language: 'id', ingredients: ['1 ayam'], steps: ['Rebus ayam.'], popularity: 3
};
const dish = {
  id: 'soto-banjar', name: 'Soto Banjar', group: 'soups', provinceCodes: ['63'], originStatus: 'wikipedia-listed', summary: '',
  sources: [{ url: 'https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia', role: 'province-list' }]
};

test('a minimal dish passes and bad records are rejected', () => {
  assert.equal(isCuisineDish(dish), true);
  assert.equal(isCuisineDish({ ...dish, group: 'dragons' }), false);
  assert.equal(isCuisineDish({ ...dish, provinceCodes: ['99'] }), false);
  assert.equal(isCuisineDish({ ...dish, provinceCodes: ['63', '63'] }), false);
  assert.equal(isCuisineDish({ ...dish, summary: 'text' }), false, 'a summary needs its language');
  assert.equal(isCuisineDish({ ...dish, summary: 'text', summaryLanguage: 'id' }), true);
  assert.equal(isCuisineDish({ ...dish, articleUrl: 'https://example.com/wiki/x' }), false);
  assert.equal(isCuisineDish({ ...dish, recipes: [] }), false);
  assert.equal(isCuisineDish({ ...dish, recipes: [recipe, recipe] }), false, 'recipe ids are unique within a dish');
  assert.equal(isCuisineDish({ ...dish, recipes: [recipe] }), true);
  assert.equal(isCuisineDish({ ...dish, sources: [] }), false);
});

test('recipes need an https source, steps and ingredients', () => {
  assert.equal(isCuisineRecipe(recipe), true);
  assert.equal(isCuisineRecipe({ ...recipe, url: 'http://cookpad.com/id/resep/1' }), false);
  assert.equal(isCuisineRecipe({ ...recipe, steps: [] }), false);
  assert.equal(isCuisineRecipe({ ...recipe, ingredients: [''] }), false);
  assert.equal(isCuisineRecipe({ ...recipe, language: 'en' }), false);
});

test('photos are external references only: local, data and unknown-host images cannot be expressed', () => {
  const commons = { source: 'commons', ref: 'e/e2/Nasi_Rendang.JPG', width: 1200, credit: 'A', license: 'CC BY-SA 3.0' };
  const cookpad = { source: 'cookpad', ref: '14346308/b6485d2e025f0c41', credit: 'Ani', license: '' };
  assert.equal(isCuisineImage(commons), true);
  assert.equal(isCuisineImage(cookpad), true);
  assert.equal(isCuisineImage({ ...commons, license: '' }), false, 'a Commons photo needs an open licence');
  assert.equal(isCuisineImage({ ...commons, credit: '' }), false, 'a Commons photo needs an author');
  assert.equal(isCuisineImage({ ...commons, ref: '/static/images/rendang.jpg' }), false);
  assert.equal(isCuisineImage({ ...commons, ref: 'data:image/png;base64,AAAA' }), false);
  assert.equal(isCuisineImage({ ...commons, width: undefined }), false);
  assert.equal(isCuisineImage({ ...cookpad, ref: 'https://evil.example/x.jpg' }), false);
  assert.equal(isCuisineImage({ source: 'r2', ref: 'x', credit: '', license: '' }), false);
});

test('image URLs are rebuilt from the reference and never exceed the original width', () => {
  const commons = { source: 'commons', ref: 'e/e2/Nasi_Rendang.JPG', width: 1200, credit: 'A', license: 'CC BY-SA 3.0' };
  assert.equal(cuisineImageUrl(commons, 'medium'), 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Nasi_Rendang.JPG/500px-Nasi_Rendang.JPG');
  assert.equal(cuisineImageUrl({ ...commons, width: 300 }, 'large'), 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Nasi_Rendang.JPG');
  assert.equal(cuisineImagePage(commons), 'https://commons.wikimedia.org/wiki/File:Nasi_Rendang.JPG');
  const cookpad = { source: 'cookpad', ref: '14346308/b6485d2e025f0c41', credit: 'Ani', license: '' };
  assert.equal(cuisineImageUrl(cookpad, 'small'), 'https://img-global.cpcdn.com/recipes/b6485d2e025f0c41/300x225cq80/photo.jpg');
  assert.equal(cuisineImagePage(cookpad), 'https://cookpad.com/id/resep/14346308');
  assert.equal(isShareableCuisinePhoto(commons), true);
  assert.equal(isShareableCuisinePhoto(cookpad), false, 'Cookpad sends no CORS header, so its photos cannot be drawn on a share card');
});

test('a province catalog only holds dishes listed in that province', () => {
  const catalog = { schemaVersion: 2, fetchedAt: '2026-01-01T00:00:00Z', provinceCode: '63', dishes: [dish] };
  assert.equal(isCuisineCatalog(catalog), true);
  assert.equal(isCuisineCatalog({ ...catalog, provinceCode: '11' }), false);
  assert.equal(isCuisineCatalog({ ...catalog, dishes: [dish, dish] }), false);
  assert.equal(isCuisineCatalog({ ...catalog, schemaVersion: 1 }), false);
});

test('filters search names and ingredients, and sorting puts the best documented dishes first', () => {
  const rawon = { ...dish, id: 'rawon', name: 'Rawon', group: 'soups', recipes: [{ ...recipe, id: 'a', ingredients: ['keluak'] }, { ...recipe, id: 'b' }], images: [{ source: 'cookpad', ref: '1/aaaaaaaa', credit: 'x', license: '' }] };
  const dishes = [dish, rawon];
  assert.deepEqual(filterDishes(dishes, { query: 'rawon' }).map(item => item.id), ['rawon']);
  assert.deepEqual(filterDishes(dishes, { query: 'KELUAK' }).map(item => item.id), ['rawon'], 'ingredients are searchable');
  assert.deepEqual(filterDishes(dishes, { content: 'recipe' }).map(item => item.id), ['rawon']);
  assert.deepEqual(filterDishes(dishes, { content: 'photo' }).map(item => item.id), ['rawon']);
  assert.deepEqual(filterDishes(dishes, { group: 'rice' }), []);
  assert.deepEqual(sortDishes(dishes, 'recipes', 'ascending', 'id').map(item => item.id), ['rawon', 'soto-banjar']);
  assert.deepEqual(sortDishes(dishes, 'name', 'descending', 'id').map(item => item.id), ['soto-banjar', 'rawon']);
});

test('dish names are classified by their words and non-food articles are dropped', () => {
  assert.equal(classifyDish('Soto Banjar'), 'soups');
  assert.equal(classifyDish('Es Teler'), 'drinks');
  assert.equal(classifyDish('Mie Aceh'), 'noodles');
  assert.equal(classifyDish('Nasi Goreng'), 'rice');
  assert.equal(classifyDish('Sate Madura'), 'meat-fish');
  assert.equal(classifyDish('Kue Lapis'), 'snacks');
  assert.equal(classifyDish('Sambal Terasi'), 'condiments');
  assert.equal(classifyDish('Abangan'), 'other');
  assert.equal(isLikelyDish({ description: 'agama', summary: 'Kajawen berarti Jawanisme, kepercayaan spiritual.', hasArticle: true }), false);
  assert.equal(isLikelyDish({ description: 'hidangan', summary: '', hasArticle: true }), true);
  assert.equal(isLikelyDish({ description: 'pulau', summary: 'Pulau di Indonesia.', hasArticle: true, hasRecipe: true }), true, 'a found recipe proves a dish');
  assert.equal(isLikelyDish({ hasArticle: false }), true, 'entries without an article are kept');
});

test('Cookpad parsing keeps only titles that name the dish and reduces a page to the fields the atlas keeps', () => {
  assert.equal(titleNamesDish('Soto Banjar Ala Chef', 'Soto Banjar'), true);
  assert.equal(titleNamesDish('Soto Betawi', 'Soto Banjar'), false);
  assert.equal(titleNamesDish('Rendang', 'Re'), false, 'very short names never match');
  assert.equal(dishKey('Ba\'e Neba'), 'ba e neba');

  const search = '<a class="block-link__main" itemprop="url" href="/id/resep/11">\n Soto &amp; Banjar\n</a><a class="block-link__main" href="/id/resep/11">dup</a><a class="block-link__main" href="/id/resep/12">Rawon</a>';
  assert.deepEqual(parseSearchResults(search), [{ id: '11', title: 'Soto & Banjar' }, { id: '12', title: 'Rawon' }]);

  const ld = { '@type': 'Recipe', name: 'Rendang Telur', author: { name: 'Ani', url: 'https://cookpad.com/id/pengguna/1' }, recipeYield: '2 orang',
    image: 'https://img-global.cpcdn.com/recipes/b6485d2e025f0c41/1200x630cq80/photo.jpg', recipeIngredient: ['5 telur', ' 3 sdm minyak '],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Rebus telur.' }, { text: 'Tumis bumbu.' }],
    interactionStatistic: [{ interactionType: 'http://schema.org/LikeAction', userInteractionCount: 7 }, { interactionType: 'http://schema.org/BookmarkAction', userInteractionCount: 2 }],
    comment: [{ text: 'private comment' }] };
  const page = '<script type="application/ld+json">{"@type":"WebSite"}</script><script type="application/ld+json">' + JSON.stringify(ld) + '</script>';
  const parsed = extractRecipe(page, '99');
  assert.deepEqual(parsed.ingredients, ['5 telur', '3 sdm minyak']);
  assert.equal(parsed.steps.length, 2);
  assert.equal(parsed.likes, 7);
  assert.equal(parsed.bookmarks, 2);
  assert.equal(parsed.url, 'https://cookpad.com/id/resep/99');
  assert.equal('comment' in parsed, false, 'comments are never kept');
  assert.equal(extractRecipe('<html></html>', '1'), undefined);
});

test('Wikipedia parsing reads the Commons hash path, width and the first open licence', () => {
  const rest = { originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Nasi_Rendang.JPG', width: 1200 } };
  assert.deepEqual(leadImage(rest), { fileName: 'Nasi_Rendang.JPG', path: 'e/e2/Nasi_Rendang.JPG', width: 1200 });
  assert.equal(leadImage({ originalimage: { source: 'https://upload.wikimedia.org/wikipedia/id/e/e2/Local.png', width: 10 } }), undefined, 'files local to id.wikipedia.org are skipped');
  assert.equal(leadImage({ originalimage: { source: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Map.svg', width: 10 } }), undefined);
  const html = '<span class="licensetpl&#95;short">GFDL</span><span class="licensetpl&#95;short">CC-BY-SA-3.0</span><td id="fileinfotpl_aut" class="x">Author</td><td>\n<a href="/wiki/User:Midori">Midori</a></td>';
  const file = parseCommonsFilePage(html, 'Nasi_Rendang.JPG');
  assert.equal(file.license, 'CC BY-SA 3.0');
  assert.equal(file.credit, 'Midori');
  assert.equal(parseCommonsFilePage('<span class="licensetpl_short">All rights reserved</span>', 'x.jpg').license, '');
  assert.ok(trimSummary('Kalimat pertama cukup panjang di sini. Kalimat kedua yang jauh lebih panjang lagi.', 50).endsWith('.'));
});

test('assembling a dish orders recipes and photos and keeps the record valid', () => {
  const item = { id: 'soto-banjar', name: 'Soto Banjar', provinceCodes: ['63'], originStatus: 'wikipedia-listed', articleUrl: 'https://id.wikipedia.org/wiki/Soto_banjar', image: null,
    recipe: { ingredients: ['a'], steps: ['b'], sourceUrl: 'https://huggingface.co/datasets/LorthGyu/indonesian-recipes', status: 'source' },
    sources: [{ url: 'https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia', role: 'province-list' }] };
  const cookpad = [
    { id: '1', title: 'Soto Banjar', url: 'https://cookpad.com/id/resep/1', author: 'A', ingredients: ['x'], steps: ['y'], likes: 1, bookmarks: 0, image: 'https://img-global.cpcdn.com/recipes/aaaaaaaa11/1200x630cq80/photo.jpg' },
    { id: '2', title: 'Soto Banjar', url: 'https://cookpad.com/id/resep/2', author: 'B', ingredients: ['x'], steps: ['y'], likes: 9, bookmarks: 1, image: 'https://img-global.cpcdn.com/recipes/bbbbbbbb22/1200x630cq80/photo.jpg' }
  ];
  const wikipedia = { summary: 'Soto Banjar adalah soto khas Banjar.', image: { fileName: 'Soto.jpg', path: 'a/ab/Soto.jpg', width: 800, credit: 'C', license: 'CC BY 4.0' } };
  const result = assembleDish({ item, cookpad, wikipedia });
  assert.equal(isCuisineDish(result), true);
  assert.deepEqual(result.recipes.map(entry => entry.id), ['cookpad-2', 'cookpad-1', 'lorthgyu-soto-banjar']);
  // The current recipe pipeline intentionally prioritizes Cookpad author photos over Commons fallback.
  assert.deepEqual(result.images.map(entry => entry.source), ['cookpad', 'cookpad', 'commons']);
  assert.equal(result.group, 'soups');
  assert.equal(result.summaryLanguage, 'id');

  const bare = assembleDish({ item: { ...item, recipe: null }, cookpad: [], wikipedia: undefined });
  assert.equal(isCuisineDish(bare), true);
  assert.equal('recipes' in bare, false);
  assert.equal('images' in bare, false);
});

test('published index, 38 province shards and the national file agree', async () => {
  const index = await readJson('static/data/cuisine/index.json');
  const national = await readJson('static/data/cuisine/national.json');
  assert.equal(isCuisineIndex(index), true);
  assert.equal(isCuisineCatalog(national), true);
  assert.equal(national.provinceCode, null);
  assert.equal(national.dishes.length, index.coverage.totalDishes);
  assert.equal(national.dishes.filter(item => item.recipes).length, index.coverage.withRecipe);
  assert.equal(national.dishes.filter(item => item.images).length, index.coverage.withImage);
  assert.equal(national.dishes.filter(item => item.summary).length, index.coverage.withSummary);
  assert.equal(national.dishes.reduce((total, item) => total + (item.recipes?.length ?? 0), 0), index.coverage.recipes);
  assert.equal(national.dishes.filter(item => item.provinceCodes.length === 0).length, index.coverage.withoutProvince);
  const groupTotal = Object.values(index.groupCounts).reduce((total, count) => total + count, 0);
  assert.equal(groupTotal, index.coverage.totalDishes);

  for (const summary of index.provinces) {
    const shard = await readJson('static' + summary.shard);
    assert.equal(isCuisineCatalog(shard), true);
    assert.equal(shard.provinceCode, summary.provinceCode);
    assert.equal(shard.dishes.length, summary.count);
    assert.equal(shard.dishes.filter(item => item.recipes).length, summary.withRecipe);
    assert.equal(shard.dishes.filter(item => item.images).length, summary.withImage);
    const expected = national.dishes.filter(item => item.provinceCodes.includes(summary.provinceCode)).map(item => item.id).sort();
    assert.deepEqual(shard.dishes.map(item => item.id).sort(), expected);
  }
});

test('every published recipe keeps its source link and every photo is an external reference', async () => {
  const national = await readJson('static/data/cuisine/national.json');
  for (const item of national.dishes) {
    for (const entry of item.recipes ?? []) {
      assert.match(entry.url, /^https:\/\/(?:cookpad\.com\/id\/resep\/\d+|huggingface\.co\/|id\.wikipedia\.org\/)/, item.id + ' recipe source');
      if (entry.source === 'cookpad') assert.ok(entry.author, item.id + ': Cookpad recipes are shown with their author');
    }
    for (const image of item.images ?? []) assert.match(cuisineImageUrl(image, 'large'), /^https:\/\/(?:upload\.wikimedia\.org\/|img-global\.cpcdn\.com\/)/, item.id + ' photo host');
  }
});

test('cuisine copy is present in all thirteen locales', async () => {
  const keys = ['layer_cuisine', 'cuisine_search', 'cuisine_choose_province', 'cuisine_empty', 'cuisine_minutes', 'cuisine_id_fallback', 'cuisine_machine_notice',
    'cuisine_ingredients', 'cuisine_steps', 'cuisine_count', 'cuisine_with_recipe', 'cuisine_group_rice', 'cuisine_group_noodles', 'cuisine_group_soups',
    'cuisine_group_meat_fish', 'cuisine_group_vegetables', 'cuisine_group_snacks', 'cuisine_group_drinks', 'cuisine_group_condiments', 'cuisine_group_other',
    'cuisine_filter_group', 'cuisine_filter_content', 'cuisine_filter_recipe', 'cuisine_filter_photo', 'cuisine_open_details', 'cuisine_recipes_heading',
    'cuisine_recipe_count', 'cuisine_recipe_n', 'cuisine_by_author', 'cuisine_view_source', 'cuisine_no_recipe_yet', 'cuisine_summary', 'cuisine_no_summary',
    'cuisine_in_provinces', 'cuisine_share_heading', 'cuisine_share_caveat', 'cuisine_coverage_note', 'cuisine_metric_with_recipe', 'cuisine_metric_with_photo'];
  const english = await readJson('messages/en.json');
  for (const locale of LOCALES) {
    const messages = await readJson('messages/' + locale + '.json');
    for (const key of keys) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), locale + ': ' + key);
      for (const placeholder of english[key].match(/\{\w+\}/g) ?? []) assert.ok(messages[key].includes(placeholder), locale + ': ' + key + ' keeps ' + placeholder);
    }
  }
});

test('cuisine assets are JSON metadata only: no hosted or committed photo files', async () => {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) await visit(path);
      else assert.match(path, /\.json$/i, 'only JSON metadata, never binary photo assets: ' + path);
    }
  }
  await visit('static/data/cuisine');
});
