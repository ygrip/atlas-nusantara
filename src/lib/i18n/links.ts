import { getLocale } from '$lib/paraglide/runtime.js';
import { localizedPath } from './paths.js';

/** Site link in the visitor's current language. Reactive when called inside a template. */
export function pathFor(path: string): string {
  return localizedPath(path, getLocale());
}
