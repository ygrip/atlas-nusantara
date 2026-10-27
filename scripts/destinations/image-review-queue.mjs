/**
 * Export every destination as a human-reviewable image discovery item.
 * No Google scraping, image harvesting, or unlicensed photos are published.
 *
 * Usage:
 * node scripts/destinations/image-review-queue.mjs /tmp/destination-photos.jsonl [--missing-only] [--province=34] [--limit=100]
 */
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const folder = fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));

export function discoveryLinks(place) {
  const parts = [place.name, place.sourceDistrict, place.sourceProvince, 'Indonesia'].filter(Boolean);
  const search = parts.join(' ');
  const commons = search + ' filetype:jpg';
  return {
    googleImages: 'https://www.google.com/search?' + new URLSearchParams({ tbm: 'isch', q: search }),
    googleCommons: 'https://www.google.com/search?' + new URLSearchParams({ tbm: 'isch', q: search + ' site:commons.wikimedia.org/wiki/File:' }),
    wikimediaCommons: 'https://commons.wikimedia.org/w/index.php?' + new URLSearchParams({
      title: 'Special:MediaSearch', type: 'image', search: commons
    }),
    ...(Number.isFinite(place.lat) && Number.isFinite(place.lon) ? {
      commonsNearby: 'https://commons.wikimedia.org/wiki/Special:Nearby?' + new URLSearchParams({
        lat: String(place.lat), lon: String(place.lon)
      })
    } : {})
  };
}

export async function buildImageReviewQueue({
  catalogDirectory = folder, province, missingOnly = false, limit = Infinity
} = {}) {
  const index = JSON.parse(await readFile(path.join(catalogDirectory, 'index.json'), 'utf8'));
  if (!Array.isArray(index.provinces) || index.provinces.length !== 38) {
    throw Error('Expected all 38 destination province summaries');
  }
  if (province && !index.provinces.some(item => item.provinceCode === province)) {
    throw Error('Unknown province code: ' + province);
  }
  if (!(limit === Infinity || Number.isSafeInteger(limit) && limit > 0)) {
    throw Error('limit must be a positive integer');
  }
  const records = [];
  for (const summary of index.provinces) {
    if (province && summary.provinceCode !== province) continue;
    const shard = JSON.parse(await readFile(path.join(catalogDirectory, 'provinces', summary.provinceCode + '.json'), 'utf8'));
    if (!Array.isArray(shard.landmarks) || shard.landmarks.length !== summary.count) {
      throw Error('Destination shard count mismatch: ' + summary.provinceCode);
    }
    for (const place of shard.landmarks) {
      const verifiedPhotos = place.images?.length ?? (place.image ? 1 : 0);
      if (missingOnly && verifiedPhotos > 0) continue;
      records.push({
        destinationId: place.id, officialId: place.officialId ?? null,
        name: place.name, provinceCode: place.provinceCode, province: place.sourceProvince ?? null,
        district: place.sourceDistrict ?? null,
        lat: Number.isFinite(place.lat) ? place.lat : null,
        lon: Number.isFinite(place.lon) ? place.lon : null,
        currentVerifiedPhotos: verifiedPhotos,
        requiresReview: true,
        discovery: discoveryLinks(place)
      });
      if (records.length >= limit) return records;
    }
  }
  return records;
}

async function main(args) {
  const output = args[0];
  if (!output || output.startsWith('--')) {
    throw Error('Usage: node scripts/destinations/image-review-queue.mjs <output.jsonl> [--missing-only] [--province=34] [--limit=100]');
  }
  const allowed = /^--(missing-only|province=\d{2}|limit=\d+)$/;
  for (const flag of args.slice(1)) if (!allowed.test(flag)) throw Error('Unknown option: ' + flag);
  const province = args.find(value => value.startsWith('--province='))?.split('=')[1];
  const limitArg = args.find(value => value.startsWith('--limit='))?.split('=')[1];
  const records = await buildImageReviewQueue({
    province, missingOnly: args.includes('--missing-only'),
    limit: limitArg ? Number(limitArg) : Infinity
  });
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, records.map(record => JSON.stringify(record)).join('\n') + '\n');
  console.log(JSON.stringify({ output: target, records: records.length, published: 0,
    note: 'Discovery URLs are not licensed images or automatic matching evidence.' }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
}
