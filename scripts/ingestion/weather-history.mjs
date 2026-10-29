// Builds the daily weather history for one representative point per city/regency: the last seven full days.
// See lib/history.mjs for the source and day convention.
//
// Usage: node scripts/ingestion/weather-history.mjs [output.json]
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildHistory } from './lib/history.mjs';

const output = process.argv[2] ?? 'static/data/weather/history.json';
const { edition, points } = JSON.parse(await readFile('static/data/admin-2025/forecast-points.json', 'utf8'));
const { withHistory, ...history } = await buildHistory({ points, edition });
await mkdir(dirname(output), { recursive: true });
const temporary = output + '.tmp';
await writeFile(temporary, JSON.stringify(history));
await rename(temporary, output);
console.log('Wrote', output, withHistory, 'of', points.length, 'points with history,', history.days.length, 'days');
