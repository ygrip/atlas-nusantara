/** Reproducible names-only discovery index; source bullets are not dated polities. */
import { writeFile } from 'node:fs/promises';
import { parseInventory } from './history-inventory.mjs';

const revision = 29769449;
const title = 'Daftar_kerajaan_yang_pernah_ada_di_Nusantara';
const sourceUrl = `https://id.wikipedia.org/w/index.php?title=${title}&oldid=${revision}`;
const api = `https://id.wikipedia.org/w/api.php?action=query&prop=revisions&revids=${revision}&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json`;
const response = await fetch(api, { headers: { 'User-Agent': 'AtlasNusantara/0.1 (https://github.com/ygrip/atlas-nusantara; history inventory research)' } });
if (!response.ok) throw new Error(`Wikipedia inventory fetch failed: ${response.status}`);
const payload = await response.json();
const source = Object.values(payload.query.pages)[0].revisions[0];
const features = parseInventory(source.slots.main['*'], revision, sourceUrl);
if (features.length < 700) throw new Error(`Unexpected inventory size: ${features.length}`);
const repeatedLabels = features.length - new Set(features.map(feature => feature.properties.name)).size;
const collection = {
  type: 'FeatureCollection',
  metadata: {
    title: 'Nusantara polity discovery inventory', source_url: sourceUrl,
    source_revision: revision, source_timestamp: source.timestamp,
    attribution: 'Indonesian Wikipedia contributors, Daftar kerajaan yang pernah ada di Nusantara',
    license: 'CC-BY-SA-4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    extraction: 'Names and leading aliases from visible alphabetical list bullets only; descriptions omitted. HTML comments excluded. Same-name entries retained as separate source occurrences.',
    entry_count: features.length, repeated_primary_labels: repeatedLabels,
    coverage_note: 'Discovery leads, not verified distinct kingdoms. Aliases, homonyms, overlapping entities, legendary narratives and post-1944 entries require review. No dates, rulers, summaries or geometry inferred.'
  }, features
};
await writeFile(new URL('../../static/data/history-inventory.geojson', import.meta.url), JSON.stringify(collection) + '\n');
console.log(`Wrote ${features.length} inventory source entries (${repeatedLabels} repeated labels), revision ${revision}; no chronology or boundaries inferred.`);
