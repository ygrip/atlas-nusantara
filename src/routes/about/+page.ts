import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { about, guideSummaries } from '$lib/content/editorial';

export const prerender = true;

export const load: PageLoad = () => {
  if (!about) error(404, 'Not found');
  return { about, guides: guideSummaries() };
};
