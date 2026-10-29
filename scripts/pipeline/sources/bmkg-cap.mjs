// BMKG CAP nowcast weather warnings. Reuses the fail-closed CAP adapter; no region codes are inferred.
import { XMLParser } from 'fast-xml-parser';
import { adaptBmkgCap, InactiveCapWarningError } from '../../../src/lib/data/ingestion/cap.ts';
import { fetchText } from '../lib/http.mjs';
import { warningFromRecord } from '../lib/warning.mjs';

export const BMKG_CAP = {
  id: 'bmkg-cap', name: 'BMKG', url: 'https://www.bmkg.go.id/alerts/nowcast/id', termsUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/',
  attribution: 'Weather warnings: Badan Meteorologi, Klimatologi, dan Geofisika (BMKG), Common Alerting Protocol nowcast.'
};
const MAX_CAP_DETAILS = 60;
/** Warnings expire within hours, so the CAP feed is checked as often as the Worker cron allows. */
export const CAP_INTERVAL_MINUTES = 5;

function provenanceFor(link, fetchedAt) {
  return {
    source: 'BMKG', sourceUrl: link, sourcePublishedAt: null, fetchedAt, validUntil: null, license: 'Public-Domain', licenseUrl: BMKG_CAP.termsUrl,
    reviewedBy: 'feed-declared-public-domain-not-legally-reviewed', reviewedAt: fetchedAt, coverage: ['Indonesia'], edition: null
  };
}

/** A CAP alert never changes once published, so a stored result is reused instead of downloading the detail again. */
const SKIP_MINUTES = 30;

function storedByLink(stored) {
  const byLink = new Map();
  for (const item of stored) {
    if (item?.sourceLink) byLink.set(item.sourceLink, item);
  }
  return byLink;
}

function skipMarker(link, fetchedAt) {
  const retryAt = new Date(Date.parse(fetchedAt) + SKIP_MINUTES * 60_000).toISOString();
  // Expired immediately so it never reaches the published snapshot; skipUntil stops the link being downloaded again for a while.
  return { id: 'skip:' + link, sourceLink: link, expires: fetchedAt, effective: fetchedAt, skipUntil: retryAt, skip: true };
}

/**
 * Downloads the CAP index, then only the alerts not already known.
 * `stored` holds earlier results (active alerts and skip markers) so a Worker tick makes one index request plus a few new details,
 * not one request per alert. `maxNewDetails` bounds the details fetched per run; the rest follow on the next tick.
 */
/** @param {{ fetchedAt: string, now?: number, stored?: unknown[], maxNewDetails?: number }} context */
export async function collectBmkgCap({ fetchedAt, now = Date.parse(fetchedAt), stored = [], maxNewDetails = MAX_CAP_DETAILS }) {
  const feed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(await fetchText(BMKG_CAP.url));
  const rawItems = feed?.rss?.channel?.item ?? [];
  const links = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(item => String(item.link)).slice(0, MAX_CAP_DETAILS);
  const known = storedByLink(stored);
  const warnings = [];
  const rejected = {};
  let downloaded = 0;
  for (const link of links) {
    const previous = known.get(link);
    if (previous?.skip && Date.parse(previous.skipUntil) > now) { warnings.push(previous); continue; }
    if (previous && !previous.skip && Date.parse(previous.expires) > now) { warnings.push(previous); continue; }
    if (downloaded >= maxNewDetails) continue;
    downloaded++;
    let text;
    try { text = await fetchText(link); }
    catch { rejected['fetch-failed'] = (rejected['fetch-failed'] ?? 0) + 1; continue; }
    try {
      const snapshot = adaptBmkgCap(text, { provenance: provenanceFor(link, fetchedAt), generatedAt: fetchedAt });
      warnings.push(warningFromRecord(snapshot.records[0], link));
    } catch (error) {
      if (!(error instanceof InactiveCapWarningError)) rejected['invalid-cap'] = (rejected['invalid-cap'] ?? 0) + 1;
      warnings.push(skipMarker(link, fetchedAt));
    }
  }
  return { warnings, fetched: downloaded + 1, rejected };
}
