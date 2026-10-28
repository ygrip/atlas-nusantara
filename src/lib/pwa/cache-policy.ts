const MAX_SHELL_ASSETS = 256;
const MAX_SHELL_ASSET_LENGTH = 2048;

/** Accept only unique, same-origin absolute paths emitted by the build shell manifest. */
export function isValidShellAssetList(assets: unknown): assets is string[] {
  if (!Array.isArray(assets) || assets.length === 0 || assets.length > MAX_SHELL_ASSETS) return false;
  const seen = new Set<string>();
  let totalLength = 0;
  for (const asset of assets) {
    if (typeof asset !== 'string' || asset.length > MAX_SHELL_ASSET_LENGTH || !asset.startsWith('/') || asset.startsWith('//')) return false;
    if (asset.includes(String.fromCharCode(92)) || asset.includes('?') || asset.includes('#') || /[\x00-\x1f\x7f]/.test(asset)) return false;
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(asset); } catch { return false; }
    if (decodedPath.includes(String.fromCharCode(92)) || decodedPath.startsWith('//') || decodedPath.split('/').some(segment => segment === '.' || segment === '..')) return false;
    if (decodedPath.startsWith('/api/') || decodedPath.startsWith('/data/snapshots/') || decodedPath.startsWith('/data/published/')) return false;
    if (seen.has(asset)) return false;
    seen.add(asset);
    totalLength += asset.length;
    if (totalLength > 64_000) return false;
  }
  return assets.includes('/200.html');
}

/** Large catalogues and social artwork are cached on demand, never fetched during installation. */
export function isDeferredAtlasAsset(path: string): boolean {
  if (path.startsWith('/og/')) return true;
  if (path.startsWith('/data/flora/') || path.startsWith('/data/fauna/') || path.startsWith('/data/cuisine/')) return true;
  if (path === '/data/observations/mountains.json') return true;
  if (path.startsWith('/data/observations/population-regions/')) return true;
  return path.startsWith('/data/destinations/') && path !== '/data/destinations/index.json';
}
