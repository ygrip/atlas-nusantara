import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { publish } from '../../scripts/ingestion/publish.ts';

const provenance = { source: 'BMKG', sourceUrl: 'https://data.bmkg.go.id/', sourcePublishedAt: null, fetchedAt: '2026-10-22T11:00:00Z', validUntil: null, license: 'Public-Domain', licenseUrl: 'https://data.bmkg.go.id/gempabumi/', reviewedBy: 'reviewer', reviewedAt: '2026-10-22T11:00:00Z', coverage: ['Indonesia'], edition: '2022' };
test('publisher uses repository-owned region codes, preserves unmatched codes, and writes JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nusantara-ingestion-'));
  try {
    const admin = join(directory, 'admin'); await mkdir(admin);
    await writeFile(join(admin, 'provinces.json'), JSON.stringify({ regions: [{ code: '31' }] }));
    await writeFile(join(admin, 'cities.json'), JSON.stringify({ regions: [{ code: '31.01' }] }));
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify({ type: 'incident', generatedAt: '2026-10-22T11:01:00Z', provenance,
      knownRegionCodes: ['99.99'], payload: { records: [{ id: 'incident-1', type: 'incident', observedAt: null, regionCodes: ['31.01', '99.99'], unmatchedRegionCodes: [], geometry: null, properties: {} }] } }));
    const output = join(directory, 'snapshot.json');
    await publish(input, output, admin);
    const result = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(result.records[0].regionCodes, ['31.01']);
    assert.deepEqual(result.records[0].unmatchedRegionCodes, ['99.99']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
