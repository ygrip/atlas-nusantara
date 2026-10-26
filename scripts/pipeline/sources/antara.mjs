// ANTARA News RSS. Only headline, link and time are kept; article text and images are never stored (copyright).
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../lib/http.mjs';
import { RejectionCounter } from '../lib/event.mjs';
import { canonicalUrl, cleanText, cleanTitle, parseInstant } from '../lib/text.mjs';
import { buildNewsEvent } from './news-event.mjs';

export const ANTARA = {
  id: 'antara', name: 'ANTARA News', url: 'https://www.antaranews.com/rss',
  termsUrl: 'https://www.antaranews.com/syarat-ketentuan',
  attribution: 'News headlines: ANTARA News (antaranews.com). Headlines and links only; articles belong to ANTARA.'
};
const FEEDS = ['https://www.antaranews.com/rss/warta-bumi.xml', 'https://www.antaranews.com/rss/terkini.xml'];

export function parseRss(xml) {
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false, parseTagValue: false }).parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  if (Array.isArray(items)) return items;
  return [items];
}

export function eventsFromFeed(xml, gazetteer, now, rejections) {
  const events = [];
  for (const item of parseRss(xml)) {
    const result = buildNewsEvent({
      source: ANTARA.name, title: cleanTitle(String(item.title ?? '')), excerpt: cleanText(String(item.description ?? ''), 500),
      url: canonicalUrl(String(item.link ?? '')), occurredAt: parseInstant(String(item.pubDate ?? '')), gazetteer, now, requireContext: false
    });
    if (result.event) events.push(result.event);
    else rejections.add(result.reason);
  }
  return events;
}

export async function collectAntara({ gazetteer, now }) {
  const rejections = new RejectionCounter();
  const events = [];
  let fetched = 0;
  const errors = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchText(feed);
      fetched += parseRss(xml).length;
      events.push(...eventsFromFeed(xml, gazetteer, now, rejections));
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length === FEEDS.length) throw Error(errors.join('; '));
  return { events, fetched, rejected: rejections.toObject(), warnings: errors };
}
