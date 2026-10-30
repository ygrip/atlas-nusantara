/**
 * Host-authored editorial content: per-tool articles and long-form guides.
 *
 * Content is plain JSON rendered through Svelte text nodes (never `{@html}`), so a
 * typo or hostile string cannot inject markup. Inline formatting is limited to
 * `code spans` and [links](/path-or-https-url), parsed by `inlineTokens`.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BLOCK_TYPES = ['p', 'list', 'code', 'table', 'note'];

/** @typedef {[number, number]} Range */

export const ARTICLE_LIMITS = Object.freeze({
  aboutParagraphs: /** @type {Range} */ ([2, 4]),
  features: /** @type {Range} */ ([4, 8]),
  referenceSections: /** @type {Range} */ ([2, 6]),
  faq: /** @type {Range} */ ([4, 8]),
  minimumWords: 700
});

export const GUIDE_LIMITS = Object.freeze({ sections: /** @type {Range} */ ([4, 12]), minimumWords: 1200 });

/** @param {unknown} value */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** @param {string[]} errors @param {string} where @param {unknown} value */
function requireText(errors, where, value) {
  if (!isText(value)) errors.push(`${where} must be a non-empty string`);
}

/** @param {string[]} errors @param {string} where @param {unknown} value @param {[number, number]} range */
function requireCount(errors, where, value, [min, max]) {
  if (!Array.isArray(value)) {
    errors.push(`${where} must be an array`);
    return false;
  }
  if (value.length < min || value.length > max) errors.push(`${where} must have ${min}-${max} entries (has ${value.length})`);
  return true;
}

/** @param {string[]} errors @param {string} where @param {any} block */
function validateBlock(errors, where, block) {
  if (!block || !BLOCK_TYPES.includes(block.type)) {
    errors.push(`${where}.type must be one of ${BLOCK_TYPES.join(', ')}`);
    return;
  }
  if (block.type === 'p' || block.type === 'note') requireText(errors, `${where}.text`, block.text);
  if (block.type === 'list') {
    if (!Array.isArray(block.items) || block.items.length === 0) errors.push(`${where}.items must be a non-empty array`);
    else block.items.forEach((/** @type {unknown} */ item, /** @type {number} */ index) => requireText(errors, `${where}.items[${index}]`, item));
  }
  if (block.type === 'code') {
    requireText(errors, `${where}.code`, block.code);
    if (block.language !== undefined && !isText(block.language)) errors.push(`${where}.language must be a string`);
  }
  if (block.type === 'table') {
    const columns = Array.isArray(block.head) ? block.head.length : 0;
    if (columns < 2) errors.push(`${where}.head must have at least 2 columns`);
    if (!Array.isArray(block.rows) || block.rows.length === 0) errors.push(`${where}.rows must be a non-empty array`);
    else block.rows.forEach((/** @type {unknown} */ row, /** @type {number} */ index) => {
      if (!Array.isArray(row) || row.length !== columns) errors.push(`${where}.rows[${index}] must have ${columns} cells`);
    });
  }
}

/** @param {string[]} errors @param {string} where @param {any} section */
function validateSection(errors, where, section) {
  requireText(errors, `${where}.heading`, section?.heading);
  if (!Array.isArray(section?.blocks) || section.blocks.length === 0) {
    errors.push(`${where}.blocks must be a non-empty array`);
    return;
  }
  section.blocks.forEach((/** @type {any} */ block, /** @type {number} */ index) => validateBlock(errors, `${where}.blocks[${index}]`, block));
}

/** Words of prose a reader actually sees, used to reject thin entries.
 * @param {unknown} value
 * @returns {number}
 */
export function countWords(value) {
  if (typeof value === 'string') return value.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countWords(item), 0);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((/** @type {number} */ total, [key, item]) => {
      if (['id', 'slug', 'type', 'language', 'updated', 'published', 'tools'].includes(key)) return total;
      return total + countWords(item);
    }, 0);
  }
  return 0;
}

/** @param {any} article @param {string} expectedId */
export function validateToolArticle(article, expectedId) {
  /** @type {string[]} */
  const errors = [];
  if (article?.id !== expectedId) errors.push(`id must equal the file name (${expectedId})`);
  if (!DATE.test(article?.updated ?? '')) errors.push('updated must be YYYY-MM-DD');
  if (requireCount(errors, 'about', article?.about, ARTICLE_LIMITS.aboutParagraphs)) {
    article.about.forEach((/** @type {unknown} */ paragraph, /** @type {number} */ index) => requireText(errors, `about[${index}]`, paragraph));
  }
  if (requireCount(errors, 'features', article?.features, ARTICLE_LIMITS.features)) {
    article.features.forEach((/** @type {any} */ feature, /** @type {number} */ index) => {
      requireText(errors, `features[${index}].title`, feature?.title);
      requireText(errors, `features[${index}].body`, feature?.body);
    });
  }
  requireText(errors, 'reference.title', article?.reference?.title);
  if (requireCount(errors, 'reference.sections', article?.reference?.sections, ARTICLE_LIMITS.referenceSections)) {
    article.reference.sections.forEach((/** @type {any} */ section, /** @type {number} */ index) => validateSection(errors, `reference.sections[${index}]`, section));
  }
  requireText(errors, 'example.title', article?.example?.title);
  if (!Array.isArray(article?.example?.blocks) || article.example.blocks.length === 0) errors.push('example.blocks must be a non-empty array');
  else article.example.blocks.forEach((/** @type {any} */ block, /** @type {number} */ index) => validateBlock(errors, `example.blocks[${index}]`, block));
  if (!Array.isArray(article?.limits) || article.limits.length < 2) errors.push('limits must list at least 2 honest limitations');
  else article.limits.forEach((/** @type {unknown} */ limit, /** @type {number} */ index) => requireText(errors, `limits[${index}]`, limit));
  if (requireCount(errors, 'faq', article?.faq, ARTICLE_LIMITS.faq)) {
    article.faq.forEach((/** @type {any} */ entry, /** @type {number} */ index) => {
      requireText(errors, `faq[${index}].question`, entry?.question);
      requireText(errors, `faq[${index}].answer`, entry?.answer);
    });
  }
  const words = countWords(article);
  if (words < ARTICLE_LIMITS.minimumWords) errors.push(`article has ${words} words; at least ${ARTICLE_LIMITS.minimumWords} are required`);
  return errors;
}

/** @param {any} guide @param {string} expectedSlug @param {string[]} toolIds */
export function validateGuide(guide, expectedSlug, toolIds) {
  /** @type {string[]} */
  const errors = [];
  if (guide?.slug !== expectedSlug || !SLUG.test(expectedSlug)) errors.push(`slug must equal the file name (${expectedSlug}) and be kebab-case`);
  requireText(errors, 'title', guide?.title);
  requireText(errors, 'description', guide?.description);
  if (isText(guide?.description) && guide.description.length > 170) errors.push('description must be at most 170 characters');
  if (!DATE.test(guide?.published ?? '')) errors.push('published must be YYYY-MM-DD');
  if (!DATE.test(guide?.updated ?? '')) errors.push('updated must be YYYY-MM-DD');
  if (!Array.isArray(guide?.tools)) errors.push('tools must be an array of tool ids');
  else guide.tools.forEach((/** @type {string} */ id) => {
    if (!toolIds.includes(id)) errors.push(`tools references unknown tool ${id}`);
  });
  if (!Array.isArray(guide?.intro) || guide.intro.length === 0) errors.push('intro must be a non-empty array of paragraphs');
  else guide.intro.forEach((/** @type {unknown} */ paragraph, /** @type {number} */ index) => requireText(errors, `intro[${index}]`, paragraph));
  if (requireCount(errors, 'sections', guide?.sections, GUIDE_LIMITS.sections)) {
    guide.sections.forEach((/** @type {any} */ section, /** @type {number} */ index) => validateSection(errors, `sections[${index}]`, section));
  }
  const words = countWords(guide);
  if (words < GUIDE_LIMITS.minimumWords) errors.push(`guide has ${words} words; at least ${GUIDE_LIMITS.minimumWords} are required`);
  return errors;
}

/**
 * Split text into plain, `code` and [link](href) tokens. Only site-local paths and
 * https URLs become links; anything else stays visible as plain text.
 * @param {string} text
 * @returns {Array<{kind:'text',value:string}|{kind:'code',value:string}|{kind:'link',value:string,href:string,external:boolean}>}
 */
export function inlineTokens(text) {
  /** @type {Array<any>} */
  const tokens = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push({ kind: 'text', value: text.slice(cursor, start) });
    if (match[1] !== undefined) tokens.push({ kind: 'code', value: match[1] });
    else tokens.push(linkToken(match[2], match[3], match[0]));
    cursor = start + match[0].length;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) });
  return tokens;
}

/** @param {string} label @param {string} href @param {string} raw */
function linkToken(label, href, raw) {
  const local = href.startsWith('/') && !href.startsWith('//');
  const external = href.startsWith('https://');
  if (!local && !external) return { kind: 'text', value: raw };
  return { kind: 'link', value: label, href, external };
}
