/** Pure parsing helpers for Cookpad Indonesia pages. Kept free of I/O so tests can feed them fixtures. */

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&#39;': "'" };

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&(?:amp|quot|lt|gt|nbsp|#39);/g, match => ENTITIES[match])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)));
}

/** Lowercase, accent-free, letters and digits only. */
export function dishKey(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** A recipe title names a dish when every word of the dish name appears in the title, in order. */
export function titleNamesDish(title, dishName) {
  const wanted = dishKey(dishName.replace(/\(.*?\)/g, ' '));
  if (wanted.length < 3) return false;
  const found = ' ' + dishKey(title) + ' ';
  return found.includes(' ' + wanted + ' ');
}

/** Result cards on /id/cari/<query>: link id plus visible title, de-duplicated, in page order. */
export function parseSearchResults(html) {
  const results = [];
  const seen = new Set();
  // Match links regardless of CSS class or HTML attribute ordering.
  const anchor = /<a\\b(?=[^>]*href=["'](?:https:\\/\\/cookpad\\.com)?\\/id\\/resep\\/(\\d+)(?:[?\\/#][^"']*)?["'])[^>]*>([\\s\\S]*?)<\\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = decodeEntities(match[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (title) results.push({ id, title });
  }
  return results;
}

function stepText(step) {
  if (typeof step === 'string') return step;
  return step?.text ?? '';
}

function cleanLine(text) {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function imageUrl(image) {
  const first = Array.isArray(image) ? image[0] : image;
  const url = typeof first === 'string' ? first : first?.url;
  if (typeof url !== 'string') return undefined;
  return /^https:\/\/img-global\.cpcdn\.com\//.test(url) ? url : undefined;
}

function countInteractions(statistics, type) {
  const entry = (statistics ?? []).find(item => String(item.interactionType).endsWith(type));
  return Number(entry?.userInteractionCount ?? 0);
}

/** First schema.org Recipe in the page's JSON-LD, reduced to the fields the atlas keeps. */
export function extractRecipe(html, recipeId) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const block of blocks) {
    let data;
    try { data = JSON.parse(block[1]); } catch { continue; }
    if (data?.['@type'] !== 'Recipe') continue;
    const ingredients = (data.recipeIngredient ?? []).map(cleanLine).filter(Boolean);
    const steps = (data.recipeInstructions ?? []).map(step => cleanLine(stepText(step))).filter(Boolean);
    return {
      id: String(recipeId),
      title: cleanLine(data.name),
      url: 'https://cookpad.com/id/resep/' + recipeId,
      author: cleanLine(data.author?.name),
      authorUrl: typeof data.author?.url === 'string' ? data.author.url : undefined,
      description: cleanLine(data.description).slice(0, 400),
      yield: cleanLine(data.recipeYield),
      image: imageUrl(data.image),
      datePublished: data.datePublished,
      likes: countInteractions(data.interactionStatistic, 'LikeAction'),
      bookmarks: countInteractions(data.interactionStatistic, 'BookmarkAction'),
      ingredients,
      steps
    };
  }
  return undefined;
}
