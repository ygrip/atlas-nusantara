import type { LayoutLoad } from './$types';
import { localeFromPathname } from '$lib/i18n/paths.js';
import { loadDictionaries } from '$lib/i18n/dictionary';

export const ssr = true;
export const prerender = true;
// /id and /id/ are the same page, so never rewrite the URL to add or drop a slash.
export const trailingSlash = 'ignore';

/** The page's language is downloaded before anything renders; switching language navigates, so this runs again. */
export const load: LayoutLoad = async ({ url }) => {
  await loadDictionaries(localeFromPathname(url.pathname));
  return {};
};
