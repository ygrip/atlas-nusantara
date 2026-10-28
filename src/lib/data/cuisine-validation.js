import { isProvinceCodeValue } from './destination-validation.js';

/** @typedef {import('./cuisine-contract').CuisineDish} CuisineDish */
/** @typedef {import('./cuisine-contract').CuisineCatalog} CuisineCatalog */
/** @typedef {import('./cuisine-contract').CuisineIndex} CuisineIndex */

export const CUISINE_GROUPS = ['rice', 'noodles', 'soups', 'meat-fish', 'vegetables', 'snacks', 'drinks', 'condiments', 'other'];
const ORIGIN_STATUSES = ['wikipedia-listed', 'seed-reviewed', 'unmapped'];
const RECIPE_SOURCES = ['cookpad', 'lorthgyu', 'atlas'];
const IMAGE_SOURCES = ['commons', 'cookpad'];
export const MAX_CUISINE_IMAGES = 4;
export const MAX_CUISINE_RECIPES = 4;

/** @param {unknown} value @param {number} limit */
function isText(value, limit) {
  return typeof value === 'string' && value.length <= limit;
}

/** @param {unknown} value @param {RegExp} [prefix] */
function isHttpsUrl(value, prefix) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return prefix === undefined || prefix.test(value);
  } catch {
    return false;
  }
}

/** @param {unknown} value */
export function isCuisineImage(value) {
  if (!value || typeof value !== 'object') return false;
  const image = /** @type {Record<string, unknown>} */ (value);
  if (!IMAGE_SOURCES.includes(/** @type {string} */ (image.source))) return false;
  if (!isText(image.credit, 120) || !isText(image.license, 40)) return false;
  if (typeof image.ref !== 'string') return false;
  if (image.source === 'commons') {
    // A Commons reference is a hash path plus file name, never a local path, and an open licence and an author are mandatory.
    return /^[0-9a-f]\/[0-9a-f]{2}\/[^/\\?#]{3,200}\.(?:jpe?g|png|webp)$/i.test(image.ref)
      && Number.isSafeInteger(image.width) && /** @type {number} */ (image.width) > 0
      && typeof image.license === 'string' && image.license.length > 0
      && typeof image.credit === 'string' && image.credit.length > 0;
  }
  return image.width === undefined && /^\d{1,12}\/[0-9a-f]{8,40}$/.test(image.ref);
}

/** @param {unknown} value */
export function isCuisineRecipe(value) {
  if (!value || typeof value !== 'object') return false;
  const recipe = /** @type {Record<string, unknown>} */ (value);
  if (typeof recipe.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(recipe.id)) return false;
  if (!RECIPE_SOURCES.includes(/** @type {string} */ (recipe.source))) return false;
  if (typeof recipe.title !== 'string' || !recipe.title.trim() || recipe.title.length > 200) return false;
  if (!isHttpsUrl(recipe.url)) return false;
  if (recipe.language !== 'id') return false;
  if (recipe.author !== undefined && !isText(recipe.author, 120)) return false;
  if (recipe.authorUrl !== undefined && !isHttpsUrl(recipe.authorUrl)) return false;
  if (recipe.yield !== undefined && !isText(recipe.yield, 80)) return false;
  if (recipe.difficulty !== undefined && !isText(recipe.difficulty, 40)) return false;
  if (recipe.timeMinutes !== undefined && !(Number.isSafeInteger(recipe.timeMinutes) && /** @type {number} */ (recipe.timeMinutes) > 0)) return false;
  if (recipe.popularity !== undefined && !(Number.isSafeInteger(recipe.popularity) && /** @type {number} */ (recipe.popularity) >= 0)) return false;
  const { ingredients, steps } = recipe;
  if (!Array.isArray(ingredients) || ingredients.length < 1 || ingredients.length > 80 || !ingredients.every(line => typeof line === 'string' && line.trim() && line.length <= 300)) return false;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 60 || !steps.every(line => typeof line === 'string' && line.trim() && line.length <= 2000)) return false;
  return true;
}

/** @param {unknown} value @returns {value is CuisineDish} */
export function isCuisineDish(value) {
  if (!value || typeof value !== 'object') return false;
  const dish = /** @type {Record<string, unknown>} */ (value);
  if (typeof dish.id !== 'string' || !/^[a-z0-9-]{1,120}$/.test(dish.id)) return false;
  if (typeof dish.name !== 'string' || !dish.name.trim() || dish.name.length > 160) return false;
  if (!CUISINE_GROUPS.includes(/** @type {string} */ (dish.group))) return false;
  if (!ORIGIN_STATUSES.includes(/** @type {string} */ (dish.originStatus))) return false;
  if (!Array.isArray(dish.provinceCodes) || !dish.provinceCodes.every(isProvinceCodeValue) || new Set(dish.provinceCodes).size !== dish.provinceCodes.length) return false;
  if (!isText(dish.summary, 700)) return false;
  if (dish.summary !== '' && dish.summaryLanguage !== 'id') return false;
  if (dish.articleUrl !== undefined && !isHttpsUrl(dish.articleUrl, /^https:\/\/id\.wikipedia\.org\/wiki\//)) return false;
  if (dish.images !== undefined && (!Array.isArray(dish.images) || dish.images.length < 1 || dish.images.length > MAX_CUISINE_IMAGES || !dish.images.every(isCuisineImage))) return false;
  if (dish.recipes !== undefined) {
    if (!Array.isArray(dish.recipes) || dish.recipes.length < 1 || dish.recipes.length > MAX_CUISINE_RECIPES || !dish.recipes.every(isCuisineRecipe)) return false;
    if (new Set(dish.recipes.map(recipe => recipe.id)).size !== dish.recipes.length) return false;
  }
  if (!Array.isArray(dish.sources) || dish.sources.length < 1 || !dish.sources.every(source => source && isHttpsUrl(source.url) && isText(source.role, 40))) return false;
  return true;
}

/** @param {unknown} value @returns {value is CuisineCatalog} */
export function isCuisineCatalog(value) {
  if (!value || typeof value !== 'object') return false;
  const catalog = /** @type {Partial<CuisineCatalog>} */ (value);
  if (catalog.schemaVersion !== 2) return false;
  if (typeof catalog.fetchedAt !== 'string' || !Number.isFinite(Date.parse(catalog.fetchedAt))) return false;
  if (typeof catalog.provinceCode !== 'string' && catalog.provinceCode !== null) return false;
  if (typeof catalog.provinceCode === 'string' && !isProvinceCodeValue(catalog.provinceCode)) return false;
  if (!Array.isArray(catalog.dishes) || catalog.dishes.length > 20000) return false;
  const ids = new Set();
  for (const dish of catalog.dishes) {
    if (!isCuisineDish(dish) || ids.has(dish.id)) return false;
    if (catalog.provinceCode && !dish.provinceCodes.includes(catalog.provinceCode)) return false;
    ids.add(dish.id);
  }
  return true;
}

/** @param {unknown} counts */
function isCountMap(counts) {
  return Boolean(counts) && typeof counts === 'object'
    && Object.values(/** @type {Record<string, unknown>} */ (counts)).every(count => Number.isSafeInteger(count) && /** @type {number} */ (count) >= 0);
}

/** @param {unknown} value @returns {value is CuisineIndex} */
export function isCuisineIndex(value) {
  if (!value || typeof value !== 'object') return false;
  const index = /** @type {Partial<CuisineIndex>} */ (value);
  if (index.schemaVersion !== 2) return false;
  if (typeof index.fetchedAt !== 'string' || !Number.isFinite(Date.parse(index.fetchedAt))) return false;
  if (![index.scope, index.license, index.attribution].every(text => typeof text === 'string' && text.trim())) return false;
  if (index.national !== undefined && index.national !== '/data/cuisine/national.json') return false;
  if (!Array.isArray(index.sources) || index.sources.length < 1 || !index.sources.every(source => source && typeof source.name === 'string' && isHttpsUrl(source.url))) return false;
  if (!Array.isArray(index.provinces) || index.provinces.length !== 38) return false;
  const codes = new Set();
  for (const province of index.provinces) {
    if (!province || !isProvinceCodeValue(province.provinceCode) || codes.has(province.provinceCode)) return false;
    if (![province.count, province.withRecipe, province.withImage].every(count => Number.isSafeInteger(count) && count >= 0)) return false;
    if (province.withRecipe > province.count || province.withImage > province.count) return false;
    if (province.shard !== '/data/cuisine/provinces/' + province.provinceCode + '.json') return false;
    codes.add(province.provinceCode);
  }
  const coverage = index.coverage;
  if (!coverage || !Object.values(coverage).every(count => Number.isSafeInteger(count) && /** @type {number} */ (count) >= 0)) return false;
  if (!isCountMap(index.groupCounts)) return false;
  return true;
}
