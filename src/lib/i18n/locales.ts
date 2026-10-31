// Country-to-locale coverage is documented in docs/I18N.md.
// English names also let visitors search for languages they cannot yet read.
export const localeEnglishNames = {
  en: 'English', id: 'Indonesian', ms: 'Malay', fil: 'Filipino Tagalog',
  th: 'Thai', vi: 'Vietnamese', my: 'Burmese Myanmar', km: 'Khmer Cambodian',
  lo: 'Lao', 'zh-SG': 'Chinese Mandarin', ta: 'Tamil', tet: 'Tetum', 'pt-TL': 'Portuguese', ja: 'Japanese'
} as const;

// Native display names avoid showing every choice in English.
export const localeNames = {
  en: 'English',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  fil: 'Filipino',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  my: 'မြန်မာဘာသာ',
  km: 'ខ្មែរ',
  lo: 'ລາວ',
  'zh-SG': '简体中文',
  ta: 'தமிழ்',
  tet: 'Tetun',
  'pt-TL': 'Português',
  ja: '日本語'
} as const;
