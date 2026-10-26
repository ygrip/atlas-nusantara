// Disaster type classification from Indonesian/English text, plus noise rejection for metaphors and unrelated news.
import { normalizeForMatching } from './text.mjs';

export const DISASTER_TYPES = ['flood', 'landslide', 'earthquake', 'volcano', 'fire', 'haze', 'wind', 'drought', 'tide', 'tsunami'];

/** Ordered by precedence: the first rule that matches decides the type. */
const RULES = [
  ['tsunami', ['tsunami']],
  ['volcano', ['erupsi', 'letusan gunung', 'gunung api', 'awan panas', 'volcano', 'volcanic']],
  ['earthquake', ['gempa', 'gempabumi', 'earthquake']],
  ['tide', ['gelombang pasang', 'abrasi', 'banjir rob', 'rob ']],
  ['landslide', ['longsor', 'landslide', 'pergerakan tanah']],
  ['haze', ['kabut asap', 'asap karhutla', 'haze']],
  ['fire', ['karhutla', 'kebakaran hutan', 'kebakaran lahan', 'wildfire', 'forest fire', 'titik panas', 'hotspot']],
  ['wind', ['puting beliung', 'angin kencang', 'angin puyuh', 'cuaca ekstrem', 'angin topan', 'badai tropis', 'siklon']],
  ['flood', ['banjir', 'flood', 'genangan', 'luapan sungai']],
  ['drought', ['kekeringan', 'drought', 'krisis air bersih']]
];

const NOISE_PATTERNS = [
  /\bbanjir (promo|diskon|pesanan|order|pujian|dukungan|ucapan|kritik|hujatan|bonus|penonton|like|followers|komentar|doa|bunga|tawaran|investasi|cuan|proyek)\b/,
  /\bgempa (politik|harga|saham|ekonomi|pasar|phk|digital|korupsi|kabinet|elektabilitas)\b/,
  /\blongsor (suara|elektabilitas|dukungan|harga|saham)\b/,
  /\b(badai) (phk|pemecatan|kritik)\b/,
  /\bbanjir (di|ke) (bursa|pasar|toko|e commerce)\b/,
  /\b(prediksi|ramalan) (zodiak|shio)\b/,
  /\bkabut asap (rokok|vape)\b/,
  /^ (apa itu|apa perbedaan|mengenal|mengapa|kenali|cara|tips|berapa|ini cara|fakta unik|manfaat|sejarah)\b/
];


export function isNoise(text) {
  const normalized = normalizeForMatching(text);
  return NOISE_PATTERNS.some(pattern => pattern.test(normalized));
}

/** Keywords match at a word start; a keyword with a trailing space must also end at a word boundary. */
function containsKeyword(normalized, keyword) {
  return normalized.includes(' ' + keyword);
}

/** Returns one of DISASTER_TYPES, or undefined when the text is not clearly about a natural hazard. */
export function classifyDisaster(text) {
  const normalized = normalizeForMatching(text);
  if (isNoise(text)) return undefined;
  for (const [type, keywords] of RULES) {
    if (!keywords.some(keyword => containsKeyword(normalized, keyword))) continue;
    return type;
  }
  return undefined;
}
