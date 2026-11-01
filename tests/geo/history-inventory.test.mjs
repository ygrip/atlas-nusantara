import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseInventory } from '../../scripts/geo/history-inventory.mjs';

const inventory = JSON.parse(readFileSync(new URL('../../static/data/history-inventory.geojson', import.meta.url)));

test('inventory preserves visible source occurrences, not a fabricated census or chronology', () => {
  assert.equal(inventory.metadata.source_revision, 29769449);
  assert.equal(inventory.metadata.entry_count, 827);
  assert.equal(inventory.features.length, inventory.metadata.entry_count);
  assert.equal(new Set(inventory.features.map(feature => feature.id)).size, inventory.features.length);
  assert.equal(inventory.metadata.repeated_primary_labels, 2);
  for (const feature of inventory.features) {
    assert.equal(feature.geometry, null);
    assert.equal(feature.properties.period, null);
    assert.equal(feature.properties.summary, null);
    assert.deepEqual(feature.properties.rulers, []);
    assert.equal(feature.properties.review_status, 'unreviewed_inventory');
    assert.ok(feature.properties.source_url.includes('oldid=29769449'));
  }
});

for (const fixture of [
  { markup: 'Sungenep, sebuah kerajaan di Madura. Didirikan oleh Aryawiraja dan terkait [[Majapahit]].', name: 'Sungenep', aliases: [], article: null },
  { markup: "'''Lamuri''', di Kabupaten Aceh Besar, Aceh.", name: 'Lamuri', aliases: [], article: null },
  { markup: "'''Nama''', '''Alias''': sebuah keterangan.", name: 'Nama', aliases: ['Alias'], article: null },
  { markup: '[[Kategori:Kerajaan|Nama, di Barat]] (Pulau A): sebuah keterangan.', name: 'Nama, di Barat (Pulau A)', aliases: [], article: 'https://id.wikipedia.org/wiki/Kategori%3AKerajaan' }
]) {
  test(`inventory heading keeps the entity label without descriptive prose: ${fixture.name}`, () => {
    const [feature] = parseInventory(`== S ==\n* ${fixture.markup}`, 123, 'https://example.org/?oldid=123');
    assert.equal(feature.properties.name, fixture.name);
    assert.deepEqual(feature.properties.aliases, fixture.aliases);
    assert.equal(feature.properties.article_url, fixture.article);
    assert.ok(!feature.properties.source_label.includes('sebuah'));
  });
}

test('all published inventory titles exclude sentence-length descriptions', () => {
  for (const feature of inventory.features) {
    assert.ok(!/[,;]\s*(?:sebuah|di|berada|terletak|adalah|merupakan)\b|[.!?]\s/.test(feature.properties.source_label), feature.id + ' contains prose in its title');
  }
  const sungenep = inventory.features.find(feature => feature.id === 'idwiki-29769449-0794');
  assert.equal(sungenep.properties.source_label, 'Sungenep');
  assert.equal(sungenep.properties.article_url, null);
});

test('parser excludes comments and references, accepts unbold and unclosed leads, and preserves homonyms', () => {
  const source = `<!--\n* '''Invisible'''\n-->
== J ==
* [[Kerajaan Jambu Lipo|Jambu Lipo]]: a description with '''later bold text'''.
== M ==
* '''[[Kerajaan Mataram Kuno|Mataram Kuno]]: malformed bold lead.
== P ==
* '''[[Padang Barat|Padang]]''': first distinct entity.
* '''[[Padang Utara|Padang]]''': another entity with the same primary name.
== T ==
* '''Tanjung''' (Kalimantan)
* '''Tanjung''' (Sumatra): another region.
* '''A-B''', '''Alias''': punctuation name.
* '''A B''': same potential slug, different name.
*'''NoSpace''': top-level bullets need not have a space.
== Referensi ==
* '''Not a polity''': reference text.`;
  const parsed = parseInventory(source, 123, 'https://example.org/?oldid=123');
  assert.equal(parsed.length, 9);
  assert.equal(parsed[0].properties.name, 'Jambu Lipo');
  assert.equal(parsed[1].properties.name, 'Mataram Kuno');
  assert.equal(parsed[2].properties.name, parsed[3].properties.name);
  assert.notEqual(parsed[2].properties.article_url, parsed[3].properties.article_url);
  assert.notEqual(parsed[2].id, parsed[3].id);
  assert.equal(parsed[4].properties.source_label, 'Tanjung (Kalimantan)');
  assert.deepEqual(parsed[6].properties.aliases, ['Alias']);
  assert.equal(new Set(parsed.map(feature => feature.id)).size, parsed.length);
  assert.deepEqual(parsed, parseInventory(source, 123, 'https://example.org/?oldid=123'));
});
