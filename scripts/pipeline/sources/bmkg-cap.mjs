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

export async function collectBmkgCap({ fetchedAt }) {
  const feed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(await fetchText(BMKG_CAP.url));
  const rawItems = feed?.rss?.channel?.item ?? [];
  const links = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(item => String(item.link)).slice(0, MAX_CAP_DETAILS);
  const warnings = [];
  const rejected = {};
  for (const link of links) {
    try {
      const snapshot = adaptBmkgCap(await fetchText(link), { provenance: provenanceFor(link, fetchedAt), generatedAt: fetchedAt });
      warnings.push(warningFromRecord(snapshot.records[0], link));
    } catch (error) {
      if (error instanceof InactiveCapWarningError) continue;
      rejected['invalid-cap'] = (rejected['invalid-cap'] ?? 0) + 1;
    }
  }
  return { warnings, fetched: links.length, rejected };
}
