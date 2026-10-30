import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { guideSlugs, isGuideSlug } from '$lib/content/editorial';

export const prerender = true;
export const entries: EntryGenerator = () => guideSlugs.map(slug => ({ slug }));

export const load: PageLoad = ({ params }) => {
  if (!isGuideSlug(params.slug)) error(404, 'Not found');
  return { slug: params.slug };
};
