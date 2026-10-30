import type { PageLoad } from './$types';
import { guideSummaries } from '$lib/content/editorial';

export const prerender = true;

export const load: PageLoad = () => ({ guides: guideSummaries() });
