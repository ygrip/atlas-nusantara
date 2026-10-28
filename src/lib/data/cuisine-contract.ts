/** What kind of dish it is. Inferred from the dish name by `scripts/recipes/classify.mjs`; `other` when no rule matched. */
export type CuisineGroup = 'rice' | 'noodles' | 'soups' | 'meat-fish' | 'vegetables' | 'snacks' | 'drinks' | 'condiments' | 'other';
export type CuisineRecipeSource = 'cookpad' | 'lorthgyu' | 'atlas';
export type CuisineImageSource = 'commons' | 'cookpad';

/**
 * A photo that stays where it was published; it is linked with credit and licence, never copied into the repository.
 * `ref` rebuilds every URL (see cuisine-images.ts), which keeps the province files small:
 *  - commons: the upload.wikimedia.org path "<hash dir>/<hash dir>/<file name>", for example "e/e2/Nasi_Rendang.JPG"
 *  - cookpad: "<recipe id>/<image hash>", the photo of that Cookpad recipe
 */
export interface CuisineImage {
  source: CuisineImageSource;
  ref: string;
  /** Original width in pixels (Commons photos), so a thumbnail is never requested larger than the file. */
  width?: number;
  /** Author name. */
  credit: string;
  /** Licence name such as "CC BY-SA 4.0"; "" for Cookpad photos, which are shown with credit but never drawn onto share cards. */
  license: string;
}

export interface CuisineRecipe {
  /** Unique within the dish, for example "cookpad-14346308". */
  id: string;
  source: CuisineRecipeSource;
  title: string;
  /** Page the recipe came from; always shown as the attribution link. */
  url: string;
  author?: string;
  authorUrl?: string;
  /** Free text such as "2-4 orang". */
  yield?: string;
  timeMinutes?: number;
  difficulty?: string;
  language: 'id';
  ingredients: string[];
  steps: string[];
  /** Cookpad likes plus bookmarks; used only to put the best-liked recipe first. */
  popularity?: number;
}

export interface CuisineDish {
  /** Slug of the dish name. */
  id: string;
  name: string;
  group: CuisineGroup;
  /** Provinces supported by Wikipedia's list or curated regional references; not proof of exclusive origin. */
  provinceCodes: string[];
  originStatus: 'wikipedia-listed' | 'seed-reviewed' | 'regional-source' | 'unmapped';
  /** Short Wikipedia summary in Indonesian; "" when the dish has no article. */
  summary: string;
  summaryLanguage?: 'id';
  articleUrl?: string;
  /** One to four photos; the first is the lead photo. A placeholder is shown when there are none. */
  images?: CuisineImage[];
  /** One to four recipes; reviewed Atlas recipes first, then Cookpad by popularity, then the MIT corpus. */
  recipes?: CuisineRecipe[];
  sources: { url: string; role: string; license?: string }[];
}

export interface CuisineCatalog {
  schemaVersion: 2;
  fetchedAt: string;
  /** Null for the national aggregate. */
  provinceCode: string | null;
  dishes: CuisineDish[];
}

export interface CuisineProvinceSummary {
  provinceCode: string;
  count: number;
  withRecipe: number;
  withImage: number;
  shard: string;
}

export interface CuisineIndex {
  schemaVersion: 2;
  fetchedAt: string;
  scope: string;
  license: string;
  attribution: string;
  national?: string;
  sources: { name: string; url: string }[];
  coverage: {
    totalDishes: number;
    /** Dishes no Wikipedia province list names; listed in the national file only. */
    withoutProvince: number;
    withRecipe: number;
    withImage: number;
    withSummary: number;
    recipes: number;
  };
  groupCounts: Partial<Record<CuisineGroup, number>>;
  provinces: CuisineProvinceSummary[];
}

export interface CuisineTranslation {
  name: string;
  ingredients: string[];
  steps: string[];
  status: 'machine-unreviewed' | 'human-reviewed';
}
export interface CuisineTranslations {
  locale: string;
  /** Keyed by dish id; translates the dish's first recipe. */
  items: Record<string, CuisineTranslation>;
}
