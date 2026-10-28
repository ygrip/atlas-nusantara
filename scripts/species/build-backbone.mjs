// Reads the Encyclopedia of Life / GBIF checklist archive of Indonesian species and writes the flora and fauna backbone.
// Usage: node scripts/species/build-backbone.mjs [path/to/SC_indonesia.tar.gz]
// Output: tmp/species-cache/backbone.json  (species of kingdoms Animalia and Plantae present in Indonesia)
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIRECTORY, writeCache } from './common.mjs';

const ARCHIVE = process.argv[2] ?? '/Users/yunaz.ramadhan/Downloads/atlas/SC_indonesia.tar.gz';
const EXTRACT_DIRECTORY = path.join(CACHE_DIRECTORY, 'sc_indonesia');
const KINGDOM_KINDS = { Animalia: 'fauna', Plantae: 'flora' };

async function readTable(name) {
  const text = await readFile(path.join(EXTRACT_DIRECTORY, name), 'utf8');
  const [header, ...lines] = text.split('\n').filter(line => line.length > 0);
  const columns = header.split('\t');
  return lines.map(line => Object.fromEntries(line.split('\t').map((value, index) => [columns[index], value])));
}

function lineageOf(taxon, taxaById) {
  const lineage = {};
  let current = taxon;
  for (let depth = 0; depth < 30 && taxaById.has(current.parentNameUsageID); depth++) {
    current = taxaById.get(current.parentNameUsageID);
    lineage[current.taxonRank] = current.canonicalName || current.scientificName;
  }
  return lineage;
}

async function main() {
  await mkdir(EXTRACT_DIRECTORY, { recursive: true });
  execFileSync('tar', ['-xzf', ARCHIVE, '-C', EXTRACT_DIRECTORY]);
  const taxa = await readTable('taxon.tab');
  const occurrences = await readTable('occurrence.tab');
  const measurements = await readTable('measurement_or_fact.tab');

  const taxaById = new Map(taxa.map(taxon => [taxon.taxonID, taxon]));
  const presentIds = new Set(occurrences.map(row => row.taxonID));
  const occurrenceToTaxon = new Map(occurrences.map(row => [row.occurrenceID, row.taxonID]));
  // The archive stores the number of GBIF occurrence records per species as an EOL "SampleSize" child fact.
  const sampleByParent = new Map();
  for (const row of measurements) {
    if (row.measurementType.endsWith('/SampleSize')) sampleByParent.set(row.parentMeasurementID, Number(row.measurementValue));
  }
  const recordsByTaxon = new Map();
  for (const row of measurements) {
    if (row.measurementOfTaxon !== 'true') continue;
    const taxonId = occurrenceToTaxon.get(row.occurrenceID);
    if (taxonId) recordsByTaxon.set(taxonId, sampleByParent.get(row.measurementID) ?? 0);
  }

  const species = [];
  for (const taxon of taxa) {
    if (taxon.taxonRank !== 'species' || !presentIds.has(taxon.taxonID)) continue;
    const lineage = lineageOf(taxon, taxaById);
    const kind = KINGDOM_KINDS[lineage.kingdom];
    if (!kind) continue;
    species.push({
      gbifKey: Number(taxon.taxonID),
      kind,
      name: taxon.canonicalName || taxon.scientificName,
      scientificName: taxon.scientificName,
      phylum: lineage.phylum ?? '', class: lineage.class ?? '', order: lineage.order ?? '', family: lineage.family ?? '', genus: lineage.genus ?? '',
      gbifRecords: recordsByTaxon.get(taxon.taxonID) ?? 0
    });
  }
  await writeCache('backbone.json', species);
  const counts = species.reduce((total, item) => ({ ...total, [item.kind]: (total[item.kind] ?? 0) + 1 }), {});
  console.log('Backbone species:', JSON.stringify(counts), 'sample:', JSON.stringify(species[0]));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
