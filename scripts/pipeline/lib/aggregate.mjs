// Re-aggregation shared by the CLI runner and the Cloudflare Worker: merge stored events from all sources into one snapshot.
// Pure functions, no I/O.
import { dedupeNews, limitPerDomain } from './dedupe.mjs';

export const MAX_EVENTS = 1800;
export const MAX_NEWS = 150;
export const MAX_NEWS_PER_DOMAIN = 10;
/** The browser loader rejects snapshots above 2,000,000 bytes; stay below it. */
export const MAX_SNAPSHOT_BYTES = 1_800_000;

function byNewest(first, second) {
  return Date.parse(second.occurredAt) - Date.parse(first.occurredAt);
}

/** Dedupes news only, caps each outlet, and returns every event newest first. */
export function mergeEvents(events) {
  const news = events.filter(event => event.kind === 'news');
  const others = events.filter(event => event.kind !== 'news');
  const deduped = dedupeNews(news);
  const limitedNews = limitPerDomain(deduped.events, MAX_NEWS_PER_DOMAIN).slice(0, MAX_NEWS);
  const merged = [...others, ...limitedNews].sort(byNewest).slice(0, MAX_EVENTS);
  return { events: merged, mergedNews: deduped.merged };
}

export function attributionFor(meta) {
  return { id: meta.id, name: meta.name, url: meta.url, termsUrl: meta.termsUrl, attribution: meta.attribution };
}

/**
 * @param {object} input
 * @param {string} input.fetchedAt
 * @param {object} input.warnings  { source fields, coverage, items }
 * @param {object[]} input.sourceMetas  registry metas of the sources that feed `events`
 * @param {object[]} input.events  already-cleaned events from any mix of sources
 * @param {object[]} input.statuses  per-source pipeline status entries
 */
export function buildSnapshot({ fetchedAt, warnings, sourceMetas, events, statuses }) {
  const merged = mergeEvents(events);
  return {
    schemaVersion: 2, kind: 'hazard-snapshot', fetchedAt, warnings,
    events: { sources: sourceMetas.map(attributionFor), items: merged.events },
    pipeline: { mergedNews: merged.mergedNews, sources: statuses }
  };
}

/** Drops the oldest events until the JSON fits the size budget the browser accepts. */
export function fitSnapshot(snapshot, maxBytes = MAX_SNAPSHOT_BYTES) {
  let current = snapshot;
  let text = JSON.stringify(current);
  const encoder = new TextEncoder();
  while (encoder.encode(text).byteLength > maxBytes && current.events.items.length > 0) {
    const keep = Math.floor(current.events.items.length * 0.85);
    current = { ...current, events: { ...current.events, items: current.events.items.slice(0, keep) } };
    text = JSON.stringify(current);
  }
  return { snapshot: current, text };
}
