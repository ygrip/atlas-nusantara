import type { HistoricalPolity, HistoryRegion } from './history';
import { getLocale } from '$lib/paraglide/runtime.js';
import { m, type MessageKey } from '$lib/i18n/messages';

/**
 * Source-specific editorial copy is maintained in id/en. Other locales receive
 * a brief translated *metadata overview* (name, region, period, rulers) rather
 * than an unreviewed machine translation of nuanced claims. Never present it
 * as a complete translation of the historical research note.
 */

const MAX_RULERS_IN_OVERVIEW = 4;

/** "400 BCE" / "1350 CE", in the reader's language. */
export function historyYearLabel(year: number): string {
  if (year < 0) return m.history_era_bce({ year: Math.abs(year) });
  return m.history_era_ce({ year });
}

export function historyPeriodLabel(from: number, to: number): string {
  return historyYearLabel(from) + ' – ' + historyYearLabel(to);
}

export function regionLabel(region: HistoryRegion): string {
  const key = 'history_region_' + region.replaceAll('-', '_');
  return m[key as MessageKey]();
}

/** Free-text place names are curated in English and Indonesian only; other locales show the region alone. */
export function localizedPlace(polity: HistoricalPolity): string {
  const locale = getLocale();
  if (locale === 'en') return polity.place;
  if (locale === 'id' || locale === 'ms') return polity.placeId;
  return '';
}

export function historyEventLabel(year: number): string {
  const suffix = year < 0 ? 'bce' + Math.abs(year) : String(year);
  const key = 'history_event_' + suffix;
  return m[key as MessageKey]();
}

export function localizedHistorySummary(polity: HistoricalPolity): string {
  const locale = getLocale();
  if (locale === 'id') return polity.summary.id;
  if (locale === 'en') return polity.summary.en;
  const rulerNames = polity.rulers.slice(0, MAX_RULERS_IN_OVERVIEW).map(ruler => ruler.name);
  const rulers = rulerNames.length > 0 ? rulerNames.join(', ') : m.history_unknown_rulers();
  return m.history_summary_template({
    name: polity.name,
    place: regionLabel(polity.region),
    period: historyPeriodLabel(polity.from, polity.to),
    rulers
  });
}

/** Date notes are curated in English and Indonesian; other locales show a neutral caution rather than unreviewed prose. */
export function localizedDateNote(polity: HistoricalPolity): string {
  const note = polity.dateNote;
  if (!note) return '';
  const locale = getLocale();
  if (locale === 'en') return note.en;
  if (locale === 'id' || locale === 'ms') return note.id;
  return m.history_date_note_generic();
}
