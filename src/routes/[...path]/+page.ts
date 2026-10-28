import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Unknown URLs retain the static host's HTTP 404 fallback; they are not build entries.
export const prerender = false;

/** Only known routes render; every other path is an honest 404 instead of the atlas. */
export const load: PageLoad = () => {
  error(404, 'Not found');
};
