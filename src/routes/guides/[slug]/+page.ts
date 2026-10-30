import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { guideBySlug, guides } from '$lib/content/editorial';

export const prerender = true;
export const entries: EntryGenerator = () => guides.map(guide => ({ slug: guide.slug }));

export const load: PageLoad = ({ params }) => {
  const guide = guideBySlug(params.slug);
  if (!guide) error(404, 'Not found');
  return { guide };
};
