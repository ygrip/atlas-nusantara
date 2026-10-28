/** Pure parsing helpers for the Wikipedia and Commons stage. No I/O, so tests can feed them fixtures. */
import { decodeEntities } from './cookpad-parse.mjs';

const OPEN_LICENSE = /^(?:CC0|CC[ -]BY(?:[ -]SA)?[ -]\d(?:\.\d)?|Public domain|PD)/i;

export function articleTitle(articleUrl) {
  return decodeURIComponent(String(articleUrl).split('/wiki/')[1] ?? '').replace(/_/g, ' ');
}

/** Short Indonesian summary, trimmed at a sentence end near 420 characters. */
export function summaryFromRest(rest) {
  if (rest.type === 'disambiguation') return {};
  const extract = String(rest.extract ?? '').replace(/\s+/g, ' ').trim();
  if (extract.length < 40) return {};
  return {
    summary: trimSummary(extract, 420),
    description: String(rest.description ?? '').trim().slice(0, 160),
    pageUrl: rest.content_urls?.desktop?.page
  };
}

export function trimSummary(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'));
  if (sentenceEnd > limit * 0.5) return cut.slice(0, sentenceEnd + 1);
  return cut.replace(/\s+\S*$/, '') + '…';
}

/**
 * Lead image when it lives on Commons; files local to id.wikipedia.org are skipped on purpose.
 * `path` is "<hash dir>/<hash dir>/<file name>", the layout of upload.wikimedia.org, which serves CORS headers
 * (Special:FilePath redirects do not). `width` is the original width, so no thumbnail is ever requested above it.
 */
export function leadImage(rest) {
  const original = rest.originalimage;
  const source = original?.source ?? rest.thumbnail?.source;
  if (typeof source !== 'string') return undefined;
  const match = source.match(/\/wikipedia\/commons\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2})\/([^/?]+)/);
  if (!match) return undefined;
  const fileName = decodeURIComponent(match[2]);
  if (!/\.(?:jpe?g|png|webp)$/i.test(fileName)) return undefined;
  const width = Number(original?.width ?? rest.thumbnail?.width);
  if (!Number.isSafeInteger(width) || width <= 0) return undefined;
  return { fileName, path: match[1] + '/' + match[2], width };
}

function plainText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeLicense(text) {
  const spaced = text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.replace(/^CC BY SA\b/i, 'CC BY-SA').replace(/^cc by sa\b/i, 'CC BY-SA').replace(/^CC BY (\d)/i, 'CC BY $1');
}

/** Author and the first open licence on a Commons file page; license is "" when none is acceptable. */
export function parseCommonsFilePage(html, fileName) {
  const page = decodeEntities(html);
  const licenses = [...page.matchAll(/licensetpl_short[^>]*>([\s\S]*?)<\/span>/g)].map(match => plainText(match[1]));
  const license = licenses.map(normalizeLicense).find(value => OPEN_LICENSE.test(value)) ?? '';
  const authorCell = page.match(/id="fileinfotpl_aut"[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/);
  const credit = authorCell ? plainText(authorCell[1]).slice(0, 120) : '';
  const licenseUrl = [...page.matchAll(/licensetpl_link[^>]*>([\s\S]*?)<\/span>/g)].map(match => plainText(match[1])).find(url => url.startsWith('https://creativecommons.org/')) ?? '';
  return {
    fileName,
    credit,
    license,
    licenseUrl,
    pageUrl: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(fileName).replace(/%20/g, '_')
  };
}
