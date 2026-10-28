/**
 * Resumable Wikipedia stage for the cuisine layer: a short Indonesian summary and one openly licensed lead photo per dish.
 *
 * For every dish with an Indonesian Wikipedia article this reads the REST page summary (extract and lead image file name),
 * then the Commons file description page for the author and licence. The Commons API answers 503 from many networks while
 * article and file pages still load, so the licence is read from the file page HTML. Only CC0, CC BY, CC BY-SA and public
 * domain files are kept; the photo itself is never downloaded, only linked.
 *
 * Usage:
 *   node scripts/recipes/fetch-wikipedia.mjs [--limit=100] [--concurrency=4] [--delay-ms=250]
 *
 * Cache (ignored by Git): tmp/recipes-cache/wikipedia/summary/<dishId>.json and file/<file name>.json.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleTitle, leadImage, parseCommonsFilePage, summaryFromRest } from './wikipedia-parse.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = path.join(ROOT, 'tmp/recipes-cache/wikipedia');
const NATIONAL = path.join(ROOT, 'static/data/cuisine/national.json');
const USER_AGENT = 'AtlasNusantaraCuisineBuilder/0.2 (https://github.com/ygrip/atlas-nusantara)';
const MAX_CONSECUTIVE_FAILURES = 20;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = file => access(file).then(() => true, () => false);

function parseOptions(args) {
  const options = { limit: Infinity, concurrency: 4, delayMs: 250, regionalOnly: false };
  for (const arg of args) {
    const [name, value] = arg.replace(/^--/, '').split('=');
    if (name === 'regional-only') options.regionalOnly = true;
    if (name === 'limit') options.limit = Number(value);
    if (name === 'concurrency') options.concurrency = Number(value);
    if (name === 'delay-ms') options.delayMs = Number(value);
  }
  return options;
}

let consecutiveFailures = 0;

/** Returns the response text, or undefined for 404. Throws after repeated failures. */
async function fetchText(url, delayMs, accept) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(delayMs);
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept }, signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error('HTTP ' + response.status);
      consecutiveFailures = 0;
      return await response.text();
    } catch (error) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw new Error('Wikimedia keeps failing: ' + error);
      await sleep(attempt * 4_000);
    }
  }
  throw new Error('giving up on ' + url);
}

async function readCached(file) {
  if (!(await exists(file))) return undefined;
  return JSON.parse(await readFile(file, 'utf8'));
}

async function loadFile(fileName, delayMs) {
  const file = path.join(CACHE, 'file', encodeURIComponent(fileName) + '.json');
  const cached = await readCached(file);
  if (cached) return cached;
  const html = await fetchText('https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(fileName), delayMs, 'text/html');
  const parsed = html ? parseCommonsFilePage(html, fileName) : { fileName, missing: true };
  await writeFile(file, JSON.stringify(parsed));
  return parsed;
}

async function fetchSummary(dish, delayMs) {
  const body = await fetchText('https://id.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(articleTitle(dish.articleUrl)), delayMs, 'application/json');
  return body ? JSON.parse(body) : undefined;
}

async function crawlDish(dish, delayMs) {
  const file = path.join(CACHE, 'summary', dish.id + '.json');
  const cached = await readCached(file);
  if (cached && !(cached.image && cached.image.path === undefined)) return 'cached';
  const rest = await fetchSummary(dish, delayMs);
  const record = { dishId: dish.id, ...(rest ? summaryFromRest(rest) : {}) };
  const image = rest ? leadImage(rest) : undefined;
  if (image) {
    const details = await loadFile(image.fileName, delayMs);
    record.image = { ...details, path: image.path, width: image.width };
  }
  await writeFile(file, JSON.stringify(record));
  return record.image && !record.image.missing && record.image.license ? 'photo' : 'text';
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(path.join(CACHE, 'summary'), { recursive: true });
  await mkdir(path.join(CACHE, 'file'), { recursive: true });
  const national = options.regionalOnly ? {dishes: []} : JSON.parse(await readFile(NATIONAL, 'utf8'));
  const regional = options.regionalOnly ? JSON.parse(await readFile(path.join(ROOT, 'scripts/recipes/regional-supplements.json'), 'utf8')) : [];
  const dishes = (options.regionalOnly ? regional : (national.dishes ?? national.items)).filter(item => item.articleUrl);
  const queue = [];
  for (const dish of dishes) {
    const cached = await readCached(path.join(CACHE, 'summary', dish.id + '.json'));
    // Records written before the image path and width were kept are refreshed.
    if (!cached || (cached.image && cached.image.path === undefined)) queue.push(dish);
  }
  queue.splice(options.limit);
  console.log(`${dishes.length} dishes with an article, crawling ${queue.length}`);
  const tally = { photo: 0, text: 0, cached: 0, errors: 0 };
  let done = 0;
  let stopped = false;

  async function worker() {
    while (queue.length > 0 && !stopped) {
      const dish = queue.shift();
      try {
        tally[await crawlDish(dish, options.delayMs)]++;
      } catch (error) {
        tally.errors++;
        console.error('Dish failed', dish.id, String(error));
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) stopped = true;
      }
      done++;
      if (done % 50 === 0) console.log(`${done} done`, JSON.stringify(tally));
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, worker));
  console.log('finished', JSON.stringify(tally));
  if (stopped) process.exit(2);
}

main();
