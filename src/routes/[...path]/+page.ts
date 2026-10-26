import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Only known routes render; every other path is an honest 404 instead of the atlas. */
export const load: PageLoad = () => {
  error(404, 'Not found');
};
