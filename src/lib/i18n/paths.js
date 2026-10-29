/**
 * Locale-prefixed URLs: English lives at "/", every other language under "/<locale>/".
 * Keep these codes aligned with project.inlang/settings.json (a test enforces it).
 */
export const BASE_LOCALE = 'en';
export const PREFIXED_LOCALES = ['id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];

const localePrefix = new RegExp('^/(' + PREFIXED_LOCALES.join('|') + ')(?=/|$)');

/**
 * Remove a leading locale segment so every language resolves to the same SvelteKit route.
 * @param {string} pathname
 */
export function stripLocalePrefix(pathname) {
  const stripped = pathname.replace(localePrefix, '');
  if (stripped === '') return '/';
  return stripped;
}

/**
 * Build the site path for a locale, keeping the route the visitor is on.
 * @param {string} pathname any path, with or without a locale prefix
 * @param {string} locale
 */
export function localizedPath(pathname, locale) {
  let path = pathname;
  if (!path.startsWith('/')) path = '/' + path;
  const unprefixed = stripLocalePrefix(path);
  if (locale === BASE_LOCALE) return unprefixed;
  if (unprefixed === '/') return '/' + locale;
  return '/' + locale + unprefixed;
}

/**
 * The language a path belongs to: its leading locale segment, otherwise English.
 * @param {string} pathname
 */
export function localeFromPathname(pathname) {
  const match = localePrefix.exec(pathname);
  if (match) return match[1];
  return BASE_LOCALE;
}
