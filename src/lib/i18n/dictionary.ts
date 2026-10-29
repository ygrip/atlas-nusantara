import { baseLocale } from '$lib/paraglide/runtime.js';

/**
 * Message text, one small chunk per language. A visitor downloads only their own language
 * (about 40 to 70 kB) instead of all thirteen at once (about 550 kB). The chunks are the same
 * `messages/<locale>.json` files the locale checks already validate.
 */
type Dictionary = Record<string, string>;

const loaders = import.meta.glob<Dictionary>('../../../messages/*.json', { import: 'default' });
const loaded = new Map<string, Dictionary>();
const pending = new Map<string, Promise<Dictionary | undefined>>();

function loaderFor(locale: string): (() => Promise<Dictionary>) | undefined {
  return loaders[`../../../messages/${locale}.json`];
}

/** Loads the language once; a locale without a file resolves to undefined and the base language is used. */
export function loadDictionary(locale: string): Promise<Dictionary | undefined> {
  const ready = loaded.get(locale);
  if (ready) return Promise.resolve(ready);
  const existing = pending.get(locale);
  if (existing) return existing;
  const loader = loaderFor(locale);
  if (!loader) return Promise.resolve(undefined);
  const request = loader().then(dictionary => {
    loaded.set(locale, dictionary);
    return dictionary;
  });
  pending.set(locale, request);
  // A failed download is retried by the next navigation instead of being remembered.
  request.catch(() => pending.delete(locale));
  return request;
}

/** Loads the page's language and the base language, which fills in any message a translation lacks. */
export async function loadDictionaries(locale: string): Promise<void> {
  await Promise.all([loadDictionary(locale), locale === baseLocale ? undefined : loadDictionary(baseLocale)]);
}

export function lookup(locale: string, key: string): string | undefined {
  return loaded.get(locale)?.[key] ?? loaded.get(baseLocale)?.[key];
}

const PLACEHOLDER = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Fills `{name}` placeholders. A missing input is left visible instead of silently dropped. */
export function format(template: string, inputs: Record<string, unknown> | undefined): string {
  if (!inputs) return template;
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = inputs[name];
    if (value === undefined || value === null) return placeholder;
    return String(value);
  });
}
