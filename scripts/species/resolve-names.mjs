// Resolves species names from the supplementary sources to GBIF keys (so synonyms still match) and adds
// species that the checklist backbone lacks, such as protected KSDAE species recorded after the archive was built.
// Usage: node scripts/species/resolve-names.mjs
// Needs: backbone.json, ksdae.json, earthsendangered.json, awm.json, inat-observed.json (those present are used)
// Output: name-resolution.json { normalisedName: gbifKey | null },  extras.json  [backbone-style records]
import { fetchJson, mapConcurrent, normaliseName, readCache, writeCache } from './common.mjs';

const API = 'https://api.gbif.org/v1/species/';
const CONCURRENCY = 6;
const KINDS = { Animalia: 'fauna', Plantae: 'flora' };

async function matchName(name) {
  const result = await fetchJson(API + 'match?strict=true&rank=species&name=' + encodeURIComponent(name));
  if (!result || result.matchType === 'NONE' || !result.speciesKey) return null;
  return result.speciesKey;
}

async function lineageOf(key) {
  const taxon = await fetchJson(API + key);
  if (!taxon || taxon.rank !== 'SPECIES' || !KINDS[taxon.kingdom]) return undefined;
  return {
    gbifKey: taxon.key, kind: KINDS[taxon.kingdom], name: taxon.canonicalName, scientificName: taxon.scientificName,
    phylum: taxon.phylum ?? '', class: taxon.class ?? '', order: taxon.order ?? '', family: taxon.family ?? '', genus: taxon.genus ?? '', gbifRecords: 0
  };
}

async function main() {
  const backbone = await readCache('backbone.json');
  if (!backbone) throw new Error('Run build-backbone.mjs first');
  const inBackbone = new Set(backbone.map(item => item.gbifKey));
  const knownNames = new Set(backbone.map(item => normaliseName(item.name)));
  const resolution = (await readCache('name-resolution.json')) ?? {};

  const names = new Map();
  const consider = name => { if (name && !knownNames.has(normaliseName(name))) names.set(normaliseName(name), name); };
  for (const item of (await readCache('earthsendangered.json')) ?? []) consider(item.scientificName);
  for (const item of (await readCache('awm.json')) ?? []) consider(item.scientificName);
  for (const item of (await readCache('inat-observed.json')) ?? []) consider(item.name);
  const ksdae = (await readCache('ksdae.json')) ?? [];
  for (const item of ksdae) if (!item.gbifKey) consider(item.scientificName);

  const pending = [...names.entries()].filter(([normalised]) => !(normalised in resolution));
  console.log('Names outside the backbone:', names.size, 'still to match:', pending.length);
  const keys = await mapConcurrent(pending, CONCURRENCY, ([, name]) => matchName(name), { every: 500, label: 'name matches' });
  pending.forEach(([normalised], index) => { resolution[normalised] = keys[index]; });
  await writeCache('name-resolution.json', resolution);

  const wanted = new Set([...Object.values(resolution).filter(Boolean), ...ksdae.map(item => item.gbifKey).filter(Boolean)]);
  const extras = (await readCache('extras.json')) ?? [];
  const have = new Set(extras.map(item => item.gbifKey));
  const todo = [...wanted].filter(key => !inBackbone.has(key) && !have.has(key));
  console.log('Species to add beyond the backbone:', todo.length);
  const found = await mapConcurrent(todo, CONCURRENCY, lineageOf, { every: 200, label: 'lineages' });
  const added = found.filter(Boolean).filter(item => !inBackbone.has(item.gbifKey));
  await writeCache('extras.json', [...extras, ...added]);
  console.log('Added', added.length, 'extras; unresolved names:', Object.values(resolution).filter(key => !key).length);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
