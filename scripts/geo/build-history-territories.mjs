#!/usr/bin/env node
/** Extract reviewed polity identities from Cliopatria v0.2.1 GeoJSON. See docs/HISTORY.md. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const names = {
  'Tarumanagara': 'tarumanagara', 'Sunda Kingdom': 'sunda', 'Galuh Kingdom': 'galuh',
  'Srivijaya': 'srivijaya', 'Sultanate of Sukadana': 'tanjungpura',
  'Mataram Kingdom': 'medang', 'Kahuripan': 'kahuripan',
  'Kingdom of Janggala': 'janggala', 'Kediri Kingdom': 'kediri', 'Singhasari': 'singhasari',
  'Samudera Pasai Sultanate': 'samudra-pasai', 'Majapahit': 'majapahit',
  'Sultanate of Bone': 'bone', 'Sultanate of Gowa': 'gowa-tallo', 'Sultanate of Brunei': 'brunei',
  'Sultanate of Malacca': 'malacca-sultanate', 'Demak Sultanate': 'demak',
  'Sultanate of Cirebon': 'cirebon', 'Sultanate of Aceh': 'aceh', 'Sultanate of Banjar': 'banjar',
  'Sultanate of Banten': 'banten', 'Sultanate of Johor': 'johor-sultanate',
  'Mataram Sultanate': 'mataram-islam', 'Sultanate of Jambi': 'jambi', 'Sultanate of Bima': 'bima',
  'Sultanate of Sambas': 'sambas', 'Blambangan Kingdom': 'blambangan',
  'Sultanate of Palembang': 'palembang', 'Kingdom of Bulungan': 'bulungan',
  'Sultanate of Mempawah': 'mempawah', 'Surakarta Sunanate': 'surakarta',
  'Sultan of Yogyakarta': 'yogyakarta', 'Pontianak Kadriyah Sultanate': 'pontianak',
  'Dutch East Indies': 'dutch-east-indies', 'Riau-Lingga Sultanate': 'riau-lingga'
};

const [input, output, mode] = process.argv.slice(2);
if (mode !== undefined && mode !== 'modern') throw new Error('Unknown extraction mode');
let selectedNames = names;
let minYear = -400;
let maxYear = 1944;
if (mode === 'modern') {
  selectedNames = { 'Republic of Indonesia': 'indonesia', 'East Timor': 'timor-leste' };
  minYear = 1945;
  maxYear = new Date().getUTCFullYear();
}
if (!input || !output) throw new Error('Usage: node scripts/geo/build-history-territories.mjs input.geojson output.geojson');
const source = await readFile(input);
const sourceHash = createHash('sha256').update(source).digest('hex');
const expectedHash = 'fc6f0d1e4cc42f45da83522b3696db6f2cc85ec0d12259a85c89b31347b8fc0a';
if (sourceHash !== expectedHash) throw new Error('Unexpected Cliopatria input; verify the release before updating the pinned hash.');
const data = JSON.parse(source.toString('utf8'));
const features = data.features.flatMap(feature => {
  const { Name, FromYear, ToYear } = feature.properties;
  const id = selectedNames[Name];
  if (!id || ToYear < minYear || FromYear > maxYear) return [];
  return [{ type: 'Feature', properties: { id, from: FromYear, to: ToYear, sourceName: Name }, geometry: feature.geometry }];
});
await writeFile(output, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Extracted ${features.length} dated features for ${new Set(features.map(feature => feature.properties.id)).size} polities.`);
