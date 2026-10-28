/**
 * Copy scraped Google Images URLs into the destination shards as `webImages`,
 * then rebuild national.json. Idempotent: rerun after every scrape batch.
 *
 *   node scripts/destinations/apply-google-images.mjs
 *
 * Destinations that already have a verified, licensed `image` never get
 * `webImages`; a stale `webImages` is removed once a licensed image exists.
 */
import path from 'node:path';
import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProgress, selectWebImageUrls } from './google-image-progress.mjs';
import { rebuildStaticDestinations } from './catalog-output.mjs';
import { DEFAULT_PROGRESS } from './scrape-google-images.mjs';

const DIRECTORY = fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));

/** Mutates the landmarks. Returns how many records were changed. */
export function applyWebImagesToLandmarks(landmarks, progress) {
  let changed = 0;
  for (const place of landmarks) {
    const record = progress.get(place.id);
    const urls = record?.status === 'ok' && !place.image ? selectWebImageUrls(record.images) : [];
    const before = JSON.stringify(place.webImages ?? []);
    if (urls.length) place.webImages = urls;
    else delete place.webImages;
    if (before !== JSON.stringify(place.webImages ?? [])) changed++;
  }
  return changed;
}

export async function applyGoogleImages({ directory = DIRECTORY, progressFile = DEFAULT_PROGRESS } = {}) {
  const progress = await loadProgress(progressFile);
  let changed = 0;
  const provinceDirectory = path.join(directory, 'provinces');
  for (const name of (await readdir(provinceDirectory)).filter(file => file.endsWith('.json')).sort()) {
    const filename = path.join(provinceDirectory, name);
    const shard = JSON.parse(await readFile(filename, 'utf8'));
    const shardChanges = applyWebImagesToLandmarks(shard.landmarks, progress);
    if (!shardChanges) continue;
    await writeFile(filename + '.partial', JSON.stringify(shard) + '\n');
    await rename(filename + '.partial', filename);
    changed += shardChanges;
  }
  const rebuilt = await rebuildStaticDestinations(directory);
  return { progressRecords: progress.size, changedDestinations: changed, ...rebuilt };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyGoogleImages().then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
