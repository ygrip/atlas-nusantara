/**
 * Resumable Cookpad Indonesia crawl for the cuisine layer.
 *
 * For every dish in static/data/cuisine/national.json this searches https://cookpad.com/id/cari/<dish>, keeps the
 * results whose title really names the dish, fetches those recipe pages and stores the schema.org Recipe JSON-LD
 * (title, author, ingredients, steps, yield, image URL). Pages are plain HTML; robots.txt allows them.
 *
 * Usage:
 *   node scripts/recipes/crawl-cookpad.mjs                      # all dishes
 *   node scripts/recipes/crawl-cookpad.mjs --limit=50           # first 50 unfinished dishes
 *   node scripts/recipes/crawl-cookpad.mjs --per-dish=3 --concurrency=3 --delay-ms=700
 *   node scripts/recipes/crawl-cookpad.mjs --query-file=scripts/recipes/extra-queries.txt
 *
 * Cache (ignored by Git): tmp/recipes-cache/cookpad/search/<dishId>.json and recipes/<recipeId>.json.
 * Rerun after any interruption; finished dishes are skipped. Exit 2 when Cookpad blocks us repeatedly.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dishKey, parseSearchResults, extractRecipe, titleNamesDish } from './cookpad-parse.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = path.join(ROOT, 'tmp/recipes-cache/cookpad');
const NATIONAL = path.join(ROOT, 'static/data/cuisine/national.json');
const USER_AGENT = 'AtlasNusantaraCuisineBuilder/0.2 (+https://github.com/ygrip/atlas-nusantara)';
const MAX_CONSECUTIVE_FAILURES = 15;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = file => access(file).then(() => true, () => false);

function parseOptions(args) {
  const options = { limit: Infinity, perDish: 3, concurrency: 3, delayMs: 700, queryFile: undefined };
  for (const arg of args) {
    const [name, value] = arg.replace(/^--/, '').split('=');
    if (name === 'limit') options.limit = Number(value);
    if (name === 'per-dish') options.perDish = Number(value);
    if (name === 'concurrency') options.concurrency = Number(value);
    if (name === 'delay-ms') options.delayMs = Number(value);
    if (name === 'query-file') options.queryFile = value;
  }
  return options;
}

class BlockedError extends Error {}

let consecutiveFailures = 0;

async function fetchHtml(url, delayMs) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(delayMs);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html', 'accept-language': 'id,en;q=0.5' },
        signal: AbortSignal.timeout(30_000)
      });
      if (response.status === 404) return undefined;
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        throw new Error('HTTP ' + response.status);
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      consecutiveFailures = 0;
      return await response.text();
    } catch (error) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw new BlockedError(String(error));
      await sleep(attempt * 5_000);
    }
  }
  throw new Error('giving up on ' + url);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadRecipe(recipeId, delayMs) {
  const file = path.join(CACHE, 'recipes', recipeId + '.json');
  if (await exists(file)) return readJson(file);
  const html = await fetchHtml('https://cookpad.com/id/resep/' + recipeId, delayMs);
  const recipe = html ? extractRecipe(html, recipeId) : undefined;
  const stored = recipe ?? { id: recipeId, missing: true };
  await writeFile(file, JSON.stringify(stored));
  return stored;
}

async function crawlDish(dish, query, options) {
  const searchFile = path.join(CACHE, 'search', dish.id + '.json');
  if (await exists(searchFile)) return 'cached';
  const html = await fetchHtml('https://cookpad.com/id/cari/' + encodeURIComponent(query), options.delayMs);
  const results = html ? parseSearchResults(html) : [];
  const matching = results.filter(result => titleNamesDish(result.title, dish.name)).slice(0, options.perDish);
  const recipeIds = [];
  for (const result of matching) {
    const recipe = await loadRecipe(result.id, options.delayMs);
    if (!recipe.missing && recipe.ingredients?.length && recipe.steps?.length) recipeIds.push(result.id);
  }
  await writeFile(searchFile, JSON.stringify({ dishId: dish.id, query, searched: results.length, recipeIds }));
  return recipeIds.length > 0 ? 'found' : 'none';
}

async function readExtraQueries(queryFile) {
  if (!queryFile) return [];
  const text = await readFile(path.join(ROOT, queryFile), 'utf8');
  return text.split('\n').map(line => line.trim()).filter(Boolean).map(name => ({ id: 'q-' + dishKey(name).replace(/\s+/g, '-'), name }));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(path.join(CACHE, 'search'), { recursive: true });
  await mkdir(path.join(CACHE, 'recipes'), { recursive: true });
  const national = await readJson(NATIONAL);
  const dishes = [...(national.dishes ?? national.items).map(item => ({ id: item.id, name: item.name })), ...(await readExtraQueries(options.queryFile))];
  const pending = [];
  for (const dish of dishes) {
    if (!(await exists(path.join(CACHE, 'search', dish.id + '.json')))) pending.push(dish);
  }
  const queue = pending.slice(0, options.limit);
  console.log(`${dishes.length} dishes, ${pending.length} unfinished, crawling ${queue.length}`);
  const tally = { found: 0, none: 0, cached: 0, errors: 0 };
  let done = 0;
  let blocked = false;

  async function worker() {
    while (queue.length > 0 && !blocked) {
      const dish = queue.shift();
      try {
        const outcome = await crawlDish(dish, dish.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), options);
        tally[outcome]++;
      } catch (error) {
        if (error instanceof BlockedError) { blocked = true; console.error('Blocked by Cookpad:', error.message); return; }
        tally.errors++;
        console.error('Dish failed', dish.id, String(error));
      }
      done++;
      if (done % 25 === 0) console.log(`${done} done`, JSON.stringify(tally));
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, worker));
  console.log('finished', JSON.stringify(tally));
  if (blocked) process.exit(2);
}

main();
