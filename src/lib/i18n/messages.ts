import type { m as catalog } from '$lib/paraglide/messages.js';
import { format, lookup } from './dictionary';
import { getLocale } from '$lib/paraglide/runtime.js';

/**
 * The translated messages, `m.some_key()`, as Paraglide generates them, plus one extra thing:
 * a change of language re-renders every component, including the older non-runes ones.
 *
 * Why this is needed: Svelte wraps calls such as `m.some_key()` in `untrack` inside non-runes
 * components, so they never notice that the locale (read from the URL) has changed. Svelte does
 * read the properties of an imported object before such a call. Here that read touches the
 * locale, which makes the component depend on it. Runes components do not need this.
 */
/** Name of a message that needs no inputs, e.g. 'nav_atlas'. Lets data hold a message by name and resolve it when rendering. */
type Catalog = typeof catalog;
export type MessageKey = { [Key in keyof Catalog]: {} extends Parameters<Catalog[Key]>[0] ? Key : never }[keyof Catalog];

const TRACKED_KEY = '__locale';

// A plain target, because the real module namespace has non-configurable keys a Proxy may not hide.
const functions = new Map<string, (inputs?: Record<string, unknown>) => string>();

/** One stable function per message, so `label: m.some_key` can be stored and called later. */
function messageFunction(key: string): (inputs?: Record<string, unknown>) => string {
  const existing = functions.get(key);
  if (existing) return existing;
  const created = (inputs?: Record<string, unknown>) => {
    const template = lookup(getLocale(), key);
    // Before the language has loaded (it loads before any page renders) the key stays visible, never blank.
    if (template === undefined) return key;
    return format(template, inputs);
  };
  functions.set(key, created);
  return created;
}

export const m = new Proxy({} as typeof catalog, {
  get(_target, key) {
    if (key === TRACKED_KEY) return getLocale();
    if (typeof key !== 'string') return undefined;
    return messageFunction(key);
  },
  ownKeys() {
    return [TRACKED_KEY];
  },
  getOwnPropertyDescriptor(_target, key) {
    if (key !== TRACKED_KEY) return undefined;
    return { value: undefined, enumerable: true, configurable: true, writable: true };
  }
});
