// GDELT DOC 2.0 article search. Metadata only (title, url, domain, time). GDELT limits requests, so queries are paced.
import { fetchText, sleep } from '../lib/http.mjs';
import { RejectionCounter } from '../lib/event.mjs';
import { canonicalUrl, cleanTitle, parseInstant } from '../lib/text.mjs';
import { buildNewsEvent } from './news-event.mjs';

export const GDELT = {
  id: 'gdelt', name: 'GDELT', url: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
  termsUrl: 'https://www.gdeltproject.org/about.html#termsofuse',
  attribution: 'News index: The GDELT Project (gdeltproject.org). Headlines and links only; articles belong to their publishers.'
};
const ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const REQUEST_GAP_MS = 6_500;
const FILTERS = 'sourcecountry:ID sourcelang:indonesian';
const QUERIES = [
  '(banjir OR longsor OR "banjir bandang")',
  '(gempa OR gempabumi OR tsunami OR erupsi OR "gunung api")',
  '(karhutla OR "kebakaran hutan" OR "kabut asap" OR kekeringan)',
  '("puting beliung" OR "angin kencang" OR "cuaca ekstrem" OR "gelombang pasang" OR abrasi)'
];

export function buildRequestUrl(query) {
  const parameters = new URLSearchParams({ query: query + ' ' + FILTERS, mode: 'artlist', maxrecords: '60', format: 'json', timespan: '3d', sort: 'datedesc' });
  return ENDPOINT + '?' + parameters.toString();
}

/** GDELT answers with `{}` when there are no matches and with plain text on errors. */
export function parseArticles(body) {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) throw Error('GDELT returned a non-JSON response: ' + trimmed.slice(0, 80));
  const payload = JSON.parse(trimmed);
  if (!Array.isArray(payload.articles)) return [];
  return payload.articles;
}

export function eventsFromArticles(articles, gazetteer, now, rejections) {
  const events = [];
  for (const article of articles) {
    const result = buildNewsEvent({
      source: GDELT.name, title: cleanTitle(String(article.title ?? '')), url: canonicalUrl(String(article.url ?? '')),
      occurredAt: parseInstant(String(article.seendate ?? '')), gazetteer, now, requireContext: true
    });
    if (result.event) events.push(result.event);
    else rejections.add(result.reason);
  }
  return events;
}

export async function collectGdelt({ gazetteer, now }) {
  const rejections = new RejectionCounter();
  const events = [];
  const errors = [];
  let fetched = 0;
  for (const [index, query] of QUERIES.entries()) {
    if (index > 0) await sleep(REQUEST_GAP_MS);
    try {
      const articles = parseArticles(await fetchText(buildRequestUrl(query), { retries: 3, retryDelayMs: 8_000 }));
      fetched += articles.length;
      events.push(...eventsFromArticles(articles, gazetteer, now, rejections));
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length === QUERIES.length) throw Error(errors[0]);
  return { events, fetched, rejected: rejections.toObject(), warnings: errors };
}
