import { m as catalog } from '$lib/paraglide/messages.js';
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
export const m = new Proxy({} as typeof catalog, {
  get(_target, key) {
    if (key === TRACKED_KEY) return getLocale();
    return Reflect.get(catalog, key);
  },
  ownKeys() {
    return [TRACKED_KEY];
  },
  getOwnPropertyDescriptor(_target, key) {
    if (key !== TRACKED_KEY) return undefined;
    return { value: undefined, enumerable: true, configurable: true, writable: true };
  }
});
