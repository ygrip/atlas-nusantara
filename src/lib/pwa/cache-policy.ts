/** Large atlas datasets are cached on demand, never fetched during installation. */
export function isDeferredAtlasAsset(path: string): boolean {
  if (path === '/data/observations/mountains.json') return true;
  if (path.startsWith('/data/observations/population-regions/')) return true;
  return path.startsWith('/data/destinations/') && path !== '/data/destinations/index.json';
}
