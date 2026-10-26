// Shared step for the two news sources: turn a cleaned headline into an event, or return the rejection reason.
import { classifyDisaster, isNoise } from '../lib/classify.mjs';
import { makeEvent, shortHash } from '../lib/event.mjs';

const MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const FUTURE_TOLERANCE_MS = 3600 * 1000;
const INDONESIA_CONTEXT = /\b(indonesia|bmkg|bnpb|bpbd|basarnas|pvmbg|badan geologi|polda|kodim|kabupaten|kecamatan)\b/i;

/**
 * @returns {{ event: object } | { reason: string }}
 * `requireContext` is true for global feeds (GDELT), where a headline must show an Indonesian place or agency.
 */
export function buildNewsEvent({ source, title, excerpt = '', url, occurredAt, gazetteer, now, requireContext }) {
  if (!url) return { reason: 'bad-url' };
  if (!occurredAt) return { reason: 'bad-date' };
  const age = now - Date.parse(occurredAt);
  if (age > MAX_AGE_MS) return { reason: 'too-old' };
  if (age < -FUTURE_TOLERANCE_MS) return { reason: 'future-date' };
  if (isNoise(title + ' ' + excerpt)) return { reason: 'noise' };
  const type = classifyDisaster(title) ?? classifyDisaster(excerpt.slice(0, 400));
  if (!type) return { reason: 'not-a-hazard' };
  const place = gazetteer.findInText(title + ' ' + excerpt.slice(0, 300));
  if (requireContext && !place && !INDONESIA_CONTEXT.test(title)) return { reason: 'no-indonesia-context' };
  try {
    const event = makeEvent({
      id: source.toLowerCase().replace(/[^a-z0-9]+/g, '') + ':' + shortHash(url),
      kind: 'news', source, type, title, occurredAt, url,
      place: place?.name, regionCode: place?.code, precision: place?.precision, lon: place?.lon, lat: place?.lat
    });
    return { event };
  } catch (error) {
    return { reason: error.message };
  }
}
