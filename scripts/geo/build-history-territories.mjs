#!/usr/bin/env node
/** Extract reviewed polity identities from Cliopatria v0.2.1 GeoJSON. See docs/HISTORY.md. */
import { readFile, writeFile } from 'node:fs/promises';

const names = {
  'Tarumanagara': 'tarumanagara', 'Sunda Kingdom': 'sunda', 'Galuh Kingdom': 'galuh',
  'Srivijaya': 'srivijaya', 'Mataram Kingdom': 'medang', 'Kahuripan': 'kahuripan',
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

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/geo/build-history-territories.mjs input.geojson output.geojson');
const data = JSON.parse(await readFile(input, 'utf8'));
const features = data.features.flatMap(feature => {
  const { Name, FromYear, ToYear } = feature.properties;
  const id = names[Name];
  if (!id || ToYear < -400 || FromYear > 1944) return [];
  return [{ type: 'Feature', properties: { id, from: FromYear, to: ToYear, sourceName: Name }, geometry: feature.geometry }];
});
await writeFile(output, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Extracted ${features.length} dated features for ${new Set(features.map(feature => feature.properties.id)).size} polities.`);
