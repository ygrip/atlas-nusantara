import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverCatalogImages } from './enrich-images.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cacheDirectory = process.argv[2];
  if (!cacheDirectory || cacheDirectory.startsWith('--')) {
    throw Error('Usage: node scripts/destinations/discover-images.mjs <cache-directory> [--publish]');
  }
  const catalogDirectory = fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));
  const result = await discoverCatalogImages({ catalogDirectory, cacheDirectory,
    publish: process.argv.includes('--publish') });
  console.log(JSON.stringify(result));
}
