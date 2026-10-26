// Text and URL cleaning shared by every source. Pure functions, no I/O.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
const TRACKING_PARAMETER = /^(utm_|fbclid$|gclid$|igshid$|mc_|ref$|source$)/i;
const SOURCE_SUFFIX = /\s+[-–—|]\s+(antara\s*news|antaranews\.com|antara|kompas\.com|detik\w*|cnn indonesia|tempo\.co|liputan6\.com|okezone|republika|bisnis\.com|viva|tribun\w*)\s*$/i;
const TITLE_PREFIX = /^\s*(\[[^\]]{1,20}\]|video:|foto:|infografis:|breaking news:)\s*/i;
const STOPWORDS = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'ini', 'itu', 'akibat', 'warga', 'the', 'and', 'for', 'dalam', 'atas', 'oleh', 'saat', 'usai', 'karena']);

export function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function stripHtml(value) {
  if (typeof value !== 'string') return '';
  const withoutBlocks = value.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags);
}

/** Removes control characters and markup brackets, normalises Unicode and whitespace, and caps length. */
export function cleanText(value, maxLength = 280) {
  if (typeof value !== 'string') return '';
  const printable = stripHtml(value).normalize('NFC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ');
  const collapsed = printable.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return collapsed.slice(0, maxLength - 1).trimEnd() + '…';
}

export function cleanTitle(value) {
  let title = cleanText(value, 400);
  title = title.replace(TITLE_PREFIX, '');
  title = title.replace(SOURCE_SUFFIX, '');
  return title.trim();
}

/** Only absolute https URLs without credentials survive; tracking parameters and fragments are removed. */
export function canonicalUrl(value) {
  if (typeof value !== 'string') return undefined;
  let url;
  try { url = new URL(value.trim()); } catch { return undefined; }
  const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
  if (!isHttp || url.username || url.password) return undefined;
  url.protocol = 'https:';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.replace(/^www\./, '');
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  const asText = url.toString();
  if (asText.length > 500) return undefined;
  return asText.replace(/\/$/, '');
}

export function normalizeForMatching(value) {
  const lowered = value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return ' ' + lowered.replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
}

export function titleTokens(title) {
  const words = normalizeForMatching(title).trim().split(' ');
  return new Set(words.filter(word => word.length >= 3 && !STOPWORDS.has(word)));
}

export function jaccard(first, second) {
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const token of first) { if (second.has(token)) shared += 1; }
  return shared / (first.size + second.size - shared);
}

export function parseInstant(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const gdeltForm = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim());
  if (gdeltForm) {
    const [, year, month, day, hour, minute, second] = gdeltForm;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))).toISOString();
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return undefined;
  return new Date(time).toISOString();
}

export function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}
