import type { Reroute } from '@sveltejs/kit';
import { stripLocalePrefix } from '$lib/i18n/paths.js';

/** "/id/terms" and "/terms" are the same route; Paraglide reads the locale from the URL. */
export const reroute: Reroute = ({ url }) => stripLocalePrefix(url.pathname);
