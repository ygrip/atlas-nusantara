/** Indonesia spans three standard time zones. Every place is shown on its own clock, never the viewer's. */
export interface PlaceTimeZone {
  /** IANA identifier, understood by Intl.DateTimeFormat. */
  id: 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';
  /** Indonesian abbreviation, which Intl does not produce for every browser locale. */
  abbreviation: 'WIB' | 'WITA' | 'WIT';
}

const WESTERN: PlaceTimeZone = { id: 'Asia/Jakarta', abbreviation: 'WIB' };
const CENTRAL: PlaceTimeZone = { id: 'Asia/Makassar', abbreviation: 'WITA' };
const EASTERN: PlaceTimeZone = { id: 'Asia/Jayapura', abbreviation: 'WIT' };

/** Provinces on WITA (UTC+8): Bali, Nusa Tenggara, most of Kalimantan and all of Sulawesi. */
const CENTRAL_PROVINCES = new Set(['51', '52', '53', '63', '64', '65', '71', '72', '73', '74', '75', '76']);
/** Provinces on WIT (UTC+9): Maluku and the Papua provinces. Everything else, including West and Central Kalimantan, is WIB. */
const EASTERN_PROVINCES = new Set(['81', '82', '91', '92', '93', '94', '95', '96']);

/** Accepts a province ("35") or a regency or city code ("35.77") from the atlas code edition. */
export function timeZoneForRegionCode(code: string): PlaceTimeZone {
  const province = code.split('.')[0];
  if (CENTRAL_PROVINCES.has(province)) return CENTRAL;
  if (EASTERN_PROVINCES.has(province)) return EASTERN;
  return WESTERN;
}

/** Formats an instant on the place's own wall clock, for example "14:05" or "Oct 28, 14:05". */
export function formatInZone(instant: Date | string | number, zone: PlaceTimeZone, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: zone.id }).format(new Date(instant));
}
