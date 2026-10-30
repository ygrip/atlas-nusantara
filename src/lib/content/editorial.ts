import type { ContentBlock, ContentSection, Guide, GuideSummary } from './types';

/** The atlas "About" page: what it is, key features, technical reference and FAQ. */
export type AboutPage = {
  title: string;
  description: string;
  updated: string;
  intro: string[];
  features: { title: string; body: string }[];
  reference: { title: string; sections: ContentSection[] };
  example: { title: string; blocks: ContentBlock[] };
  limits: string[];
  faq: { question: string; answer: string }[];
};

const aboutModules = import.meta.glob<AboutPage>('/content/about.json', { eager: true, import: 'default' });
const guideModules = import.meta.glob<Guide>('/content/guides/*.json', { eager: true, import: 'default' });

export const about: AboutPage | undefined = Object.values(aboutModules)[0];

export const guides: Guide[] = Object.values(guideModules).sort((left, right) => right.published.localeCompare(left.published) || left.title.localeCompare(right.title));

export function guideBySlug(slug: string): Guide | undefined {
  return guides.find(guide => guide.slug === slug);
}

export function guideSummaries(): GuideSummary[] {
  return guides.map(({ slug, title, description, published, updated, tools }) => ({ slug, title, description, published, updated, tools }));
}

/** FAQ structured data uses plain text: inline `code` and [link](...) markup is removed. */
export function plainText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/`([^`]+)`/g, '$1');
}

/** JSON embedded in a script element must never contain an HTML closing tag. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}
