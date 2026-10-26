// Collapses repeated reports of the same story. Only news is merged; official and citizen records keep their own identity.
import { jaccard, titleTokens } from './text.mjs';

const SIMILARITY_THRESHOLD = 0.72;
const SAME_STORY_WINDOW_MS = 3 * 24 * 3600 * 1000;
const SOURCE_PRIORITY = ['ANTARA News', 'GDELT'];

function priority(event) {
  const index = SOURCE_PRIORITY.indexOf(event.source);
  if (index === -1) return SOURCE_PRIORITY.length;
  return index;
}

function sourceLabel(event) {
  if (event.url) return new URL(event.url).hostname;
  return event.source;
}

function isSameStory(candidate, existing, tokensById) {
  if (candidate.type !== existing.type) return false;
  const gap = Math.abs(Date.parse(candidate.occurredAt) - Date.parse(existing.occurredAt));
  if (gap > SAME_STORY_WINDOW_MS) return false;
  if (candidate.regionCode && existing.regionCode && candidate.regionCode !== existing.regionCode) return false;
  return jaccard(tokensById.get(candidate.id), tokensById.get(existing.id)) >= SIMILARITY_THRESHOLD;
}

function mergeInto(kept, duplicate) {
  const alsoReportedBy = kept.alsoReportedBy ?? [];
  if (duplicate.url && !alsoReportedBy.some(item => item.url === duplicate.url) && alsoReportedBy.length < 5) {
    alsoReportedBy.push({ source: sourceLabel(duplicate), url: duplicate.url });
  }
  if (alsoReportedBy.length > 0) kept.alsoReportedBy = alsoReportedBy;
  if (!kept.regionCode && duplicate.regionCode) {
    kept.regionCode = duplicate.regionCode;
    kept.precision = duplicate.precision;
    kept.place = duplicate.place;
    if (duplicate.lon !== undefined) { kept.lon = duplicate.lon; kept.lat = duplicate.lat; }
  }
}

/** Returns { events, merged }. Best source wins; ties keep the earliest-seen item. */
export function dedupeNews(newsEvents) {
  const ordered = [...newsEvents].sort((a, b) => priority(a) - priority(b) || Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const tokensById = new Map(ordered.map(event => [event.id, titleTokens(event.title)]));
  const kept = [];
  const seenUrls = new Set();
  let merged = 0;
  for (const event of ordered) {
    if (event.url && seenUrls.has(event.url)) { merged += 1; continue; }
    const existing = kept.find(candidate => isSameStory(event, candidate, tokensById));
    if (existing) { mergeInto(existing, event); merged += 1; continue; }
    if (event.url) seenUrls.add(event.url);
    kept.push({ ...event });
  }
  return { events: kept, merged };
}

/** Caps how many items one web domain can contribute, so a single outlet cannot dominate the list. */
export function limitPerDomain(newsEvents, maxPerDomain) {
  const counts = new Map();
  const result = [];
  for (const event of [...newsEvents].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    const domain = event.url ? new URL(event.url).hostname : event.source;
    const count = counts.get(domain) ?? 0;
    if (count >= maxPerDomain) continue;
    counts.set(domain, count + 1);
    result.push(event);
  }
  return result;
}
