import { writeFile, mkdir } from 'node:fs/promises';
import { MOUNTAIN_SOURCE, VOLCANO_SOURCE, makeMountainOverlay } from './mountains-source.mjs';

async function query(service, params) {
  const url = new URL(service + '/query');
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('BIG responded with HTTP ' + response.status + ' for ' + service);
  const payload = await response.json();
  if (payload.error) throw Error('BIG query failed: ' + JSON.stringify(payload.error));
  return payload;
}

/** Fetch all official records: fail closed rather than publish a silently truncated atlas. */
async function allFeatures(service, fields) {
  const count = (await query(service, { where: '1=1', returnCountOnly: true, f: 'json' })).count;
  if (!Number.isSafeInteger(count) || count <= 0 || count > 10000) throw Error('Invalid BIG feature count at ' + service + ': ' + count);
  const features = [];
  for (let offset = 0; offset < count; offset += 400) {
    const payload = await query(service, {
      where: '1=1', outFields: 'OBJECTID,' + fields, returnGeometry: true,
      outSR: 4326, resultOffset: offset, resultRecordCount: 400,
      orderByFields: 'OBJECTID ASC', f: 'json'
    });
    if (!Array.isArray(payload.features) || payload.features.length === 0) throw Error('BIG returned a truncated page at offset ' + offset);
    features.push(...payload.features);
  }
  if (features.length !== count || new Set(features.map(item => item.attributes?.OBJECTID)).size !== count) {
    throw Error('BIG returned an incomplete or duplicated result set: ' + features.length + '/' + count);
  }
  return features;
}

const [peaks, volcanoes] = await Promise.all([
  allFeatures(MOUNTAIN_SOURCE, 'NAMA_UNSUR,TOPONIM'),
  allFeatures(VOLCANO_SOURCE, 'NAMA_OBJEK,TIPE,KETINGGIAN')
]);
const snapshot = makeMountainOverlay(peaks, volcanoes, new Date().toISOString());
if (snapshot.pins.length < 50 || new Set(snapshot.pins.map(pin => pin.label)).size < 100) throw Error('Mountain extraction is suspiciously small or generic; keep the previous snapshot');
const directory = 'static/data/observations';
await mkdir(directory, { recursive: true });
await writeFile(directory + '/mountains.json', JSON.stringify(snapshot) + '\n');
console.log('Generated ' + snapshot.pins.length + ' named mountain/volcano pins from BIG (' + peaks.length + ' named-feature records, ' + volcanoes.length + ' classified-volcano records).');
