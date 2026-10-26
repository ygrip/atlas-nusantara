import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adaptBmkgEarthquakes, adaptCanonicalFeed } from '../../src/lib/data/ingestion/adapters.ts';
import type { DatasetProvenance, DatasetType, Snapshot } from '../../src/lib/data/ingestion/schema.ts';

interface CliInput { type: DatasetType; payload: unknown; provenance: DatasetProvenance; generatedAt: string }

export async function publish(inputPath: string, outputPath: string, adminDirectory = 'static/data/admin-2022'): Promise<void> {
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as CliInput;
  const provinceData = JSON.parse(await readFile(resolve(adminDirectory, 'provinces.json'), 'utf8'));
  const cityData = JSON.parse(await readFile(resolve(adminDirectory, 'cities.json'), 'utf8'));
  const knownCodes = new Set([...provinceData.regions, ...cityData.regions].map(region => region.code));
  const options = { provenance: input.provenance, generatedAt: input.generatedAt, regions: { has: (code: string) => knownCodes.has(code) } };
  let snapshot: Snapshot;
  if (input.type === 'earthquake') snapshot = adaptBmkgEarthquakes(input.payload, options);
  else snapshot = adaptCanonicalFeed(input.type, input.payload, options);
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, output);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) throw new Error('usage: node --experimental-strip-types scripts/ingestion/publish.ts <input.json> <snapshot.json>');
  await publish(inputPath, outputPath);
}
