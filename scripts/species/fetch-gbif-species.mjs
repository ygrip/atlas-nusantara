// Per-species GBIF facts: IUCN Red List category and realm flags (marine / freshwater / terrestrial).
// Usage: node scripts/species/fetch-gbif-species.mjs   (resumable; progress is saved every 2000 species)
// Needs: tmp/species-cache/backbone.json.  Output: tmp/species-cache/gbif-species.json  { [gbifKey]: { iucn, realms } }
import { fetchJson, loadAllSpecies, mapConcurrent, readCache, writeCache } from './common.mjs';

const API = 'https://api.gbif.org/v1/species/';
const CONCURRENCY = 10;
const SAVE_EVERY = 2000;

async function factsFor(key) {
  const [category, profiles] = await Promise.all([
    fetchJson(API + key + '/iucnRedListCategory'),
    fetchJson(API + key + '/speciesProfiles?limit=100')
  ]);
  const realms = new Set();
  for (const profile of profiles?.results ?? []) {
    if (profile.marine) realms.add('marine');
    if (profile.freshwater) realms.add('freshwater');
    if (profile.terrestrial) realms.add('terrestrial');
  }
  return { iucn: category?.code ?? '', realms: [...realms].sort() };
}

async function main() {
  const species = await loadAllSpecies();
  const facts = (await readCache('gbif-species.json')) ?? {};
  const pending = species.map(item => item.gbifKey).filter(key => !facts[key]);
  console.log('Species still to fetch:', pending.length);
  for (let start = 0; start < pending.length; start += SAVE_EVERY) {
    const chunk = pending.slice(start, start + SAVE_EVERY);
    const results = await mapConcurrent(chunk, CONCURRENCY, factsFor, { every: 1000, label: 'gbif species chunk' });
    chunk.forEach((key, index) => { facts[key] = results[index]; });
    await writeCache('gbif-species.json', facts);
    console.log('Saved', Object.keys(facts).length);
  }
  const iucn = Object.values(facts).filter(item => item.iucn).length;
  console.log('Species with IUCN category:', iucn);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
