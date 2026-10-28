/**
 * Turns one merged Wikipedia list entry plus the cached stages into a schema 2 dish record. Pure, so tests can call it.
 *
 * Recipe order: reviewed Atlas recipes, then Cookpad recipes by popularity, then the MIT LorthGyu corpus.
 * Photo order: Cookpad recipe author photos first, then licensed Commons as fallback.
 */
import { classifyDish } from './classify.mjs';
import { isCuisineRecipe, MAX_CUISINE_IMAGES, MAX_CUISINE_RECIPES } from '../../src/lib/data/cuisine-validation.js';

const SOURCE_ORDER = { atlas: 0, cookpad: 1, lorthgyu: 2 };

function minutes(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  return undefined;
}

function withoutUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== ''));
}

/** A Cookpad crawl record to the shared recipe shape. */
export function cookpadRecipe(crawled) {
  return withoutUndefined({
    id: 'cookpad-' + crawled.id,
    source: 'cookpad',
    title: crawled.title,
    url: crawled.url,
    author: crawled.author,
    authorUrl: crawled.authorUrl,
    yield: crawled.yield,
    language: 'id',
    ingredients: crawled.ingredients,
    steps: crawled.steps,
    popularity: (crawled.likes ?? 0) + (crawled.bookmarks ?? 0)
  });
}

/** The legacy single `recipe` object (LorthGyu rows and reviewed seeds) to the shared recipe shape. */
export function legacyRecipe(item) {
  const recipe = item.recipe;
  if (!recipe) return undefined;
  const isSeed = recipe.status === 'original-adaptation';
  return withoutUndefined({
    id: isSeed ? 'atlas-' + item.id : 'lorthgyu-' + item.id,
    source: isSeed ? 'atlas' : 'lorthgyu',
    title: item.name,
    url: recipe.sourceUrl,
    timeMinutes: minutes(recipe.timeMinutes),
    difficulty: recipe.difficulty ?? undefined,
    language: 'id',
    ingredients: recipe.ingredients,
    steps: recipe.steps
  });
}

/** Commons photo from the Wikipedia stage when its licence was accepted. */
export function commonsImage(file) {
  if (!file || file.missing || !file.license || !file.credit || !file.path || !file.width) return undefined;
  return { source: 'commons', ref: file.path, width: file.width, credit: file.credit, license: file.license };
}

/** Seed photos need their hash path and width, which only the Wikipedia stage knows; they come from there when the seed has no own. */
export function seedImage(image, wikipedia) {
  if (!image) return undefined;
  const match = String(image.url ?? '').match(/\/wiki\/Special:FilePath\/([^?]+)/);
  const fileName = match ? decodeURIComponent(match[1]).replace(/ /g, '_') : '';
  const file = wikipedia?.image;
  if (!file || file.fileName.replace(/ /g, '_') !== fileName) return undefined;
  return commonsImage({ ...file, credit: image.credit ?? file.credit, license: image.license ?? file.license });
}

function cookpadImage(crawled) {
  const hash = String(crawled.image ?? '').match(/\/recipes\/([0-9a-f]{8,40})\//)?.[1];
  if (!hash) return undefined;
  return { source: 'cookpad', ref: crawled.id + '/' + hash, credit: String(crawled.author ?? '').slice(0, 120), license: '' };
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter(source => {
    const key = source.role + ' ' + source.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The name decides first; when no rule matches, the opening words of the Wikipedia summary get a second chance. */
function groupFor(name, summary) {
  const byName = classifyDish(name);
  if (byName !== 'other') return byName;
  return classifyDish(summary.slice(0, 80));
}

export function assembleDish({ item, cookpad = [], wikipedia }) {
  const recipes = [];
  const legacy = legacyRecipe(item);
  if (legacy) recipes.push(legacy);
  for (const crawled of cookpad) recipes.push(cookpadRecipe(crawled));
  const valid = recipes.filter(isCuisineRecipe);
  valid.sort((left, right) => {
    const bySource = SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source];
    if (bySource !== 0) return bySource;
    return (right.popularity ?? 0) - (left.popularity ?? 0);
  });

  const images = [];
  for (const crawled of cookpad) {
    const image = cookpadImage(crawled);
    if (image && !images.some(existing => existing.ref === image.ref) && images.length < MAX_CUISINE_IMAGES) images.push(image);
  }
  const lead = seedImage(item.image, wikipedia) ?? commonsImage(wikipedia?.image);
  if (lead && images.length < MAX_CUISINE_IMAGES) images.push(lead);

  const summary = wikipedia?.summary ?? '';
  const sources = [...item.sources];
  if (item.articleUrl && summary) sources.push({ url: item.articleUrl, role: 'summary', license: 'CC BY-SA 4.0' });
  for (const crawled of cookpad) {
    if (crawled.url) sources.push({ url: crawled.url, role: 'recipe' });
  }

  const record = withoutUndefined({
    id: item.id,
    name: item.name,
    group: groupFor(item.name, summary),
    provinceCodes: item.provinceCodes,
    originStatus: item.originStatus,
    summaryLanguage: summary ? 'id' : undefined,
    articleUrl: item.articleUrl ?? undefined,
    images: images.length > 0 ? images : undefined,
    recipes: valid.length > 0 ? valid.slice(0, MAX_CUISINE_RECIPES) : undefined,
    sources: uniqueSources(sources)
  });
  // An empty summary is meaningful (no article text), so it stays in the record.
  return { ...record, summary };
}
