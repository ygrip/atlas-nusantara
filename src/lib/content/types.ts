export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'note'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'code'; code: string; language?: string }
  | { type: 'table'; head: string[]; rows: string[][] };

export type ContentSection = { heading: string; blocks: ContentBlock[] };

export type ToolArticle = {
  id: string;
  updated: string;
  about: string[];
  features: { title: string; body: string }[];
  reference: { title: string; sections: ContentSection[] };
  example: { title: string; blocks: ContentBlock[] };
  limits: string[];
  faq: { question: string; answer: string }[];
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  tools: string[];
  intro: string[];
  sections: ContentSection[];
};

export type GuideSummary = Pick<Guide, 'slug' | 'title' | 'description' | 'published' | 'updated' | 'tools'>;
