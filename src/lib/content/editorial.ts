/** Stable slugs shared by the routes, prerender config and sitemap generator. */
export const guideSlugs = ['regions', 'conditions', 'nature'] as const;
export type GuideSlug = (typeof guideSlugs)[number];

export function isGuideSlug(slug: string): slug is GuideSlug {
  return (guideSlugs as readonly string[]).includes(slug);
}

export const guideKeys = guideSlugs.map(slug => ({
  slug,
  title: 'editorial_' + slug + '_title',
  description: 'editorial_' + slug + '_description',
  body: 'editorial_' + slug + '_body'
}));
