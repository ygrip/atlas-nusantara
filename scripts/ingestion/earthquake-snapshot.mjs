// Fetches a dated BMKG M5+ earthquake archive once. The browser reads only the local snapshot.
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { buildEarthquakeArchive, EARTHQUAKE_SOURCE_URL } from './lib/earthquakes.mjs';

const response = await fetch(EARTHQUAKE_SOURCE_URL, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw Error('BMKG archive: HTTP ' + response.status);
const archive = buildEarthquakeArchive(await response.json(), new Date().toISOString());
const output = 'static/data/observations/earthquakes.json';
await mkdir('static/data/observations', { recursive: true });
await writeFile(output + '.tmp', JSON.stringify(archive));
await rename(output + '.tmp', output);
console.log('Saved', archive.events.length, 'dated BMKG earthquake observations');
