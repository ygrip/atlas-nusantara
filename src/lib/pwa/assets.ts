import { version } from '$app/environment';

/** Mutable static data follows the application release, not an indefinite HTTP cache. */
export function assetUrl(path: string): string {
  const url = new URL(path, 'https://nusantara.readynaz.com');
  url.searchParams.set('v', version);
  return url.pathname + url.search;
}
