// Writes the region records (names, hierarchy, representative points) the Cloudflare Worker needs for geocoding.
// Run after the administrative directory or geometry changes: npm run build:gazetteer
import { mkdir, writeFile } from 'node:fs/promises';
import { loadRegionRecords } from './lib/gazetteer.mjs';

const OUTPUT = 'cloudflare/generated/regions.json';
const regions = await loadRegionRecords();
await mkdir('cloudflare/generated', { recursive: true });
await writeFile(OUTPUT, JSON.stringify(regions));
console.log('Wrote', regions.length, 'regions to', OUTPUT);
