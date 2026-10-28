export const BASE_LOCALE: string;
export const PREFIXED_LOCALES: string[];
export function stripLocalePrefix(pathname: string): string;
export function localizedPath(pathname: string, locale: string): string;
