import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import test from 'node:test';

const file = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const locales = JSON.parse(file('project.inlang/settings.json')).locales;
const base = JSON.parse(file('messages/en.json'));
const languageDataset = JSON.parse(file('static/data/observations/languages.json'));

const UI_MESSAGES = [
  'language_source_note',
  'destination_gallery_photos',
  'destination_gallery_label',
  'destination_gallery_close',
  'destination_gallery_carousel',
  'section_indonesia',
  'section_observatory',
  'island_group_sumatra',
  'island_group_java',
  'island_group_nusa_tenggara',
  'island_group_kalimantan',
  'island_group_sulawesi',
  'island_group_maluku',
  'island_group_papua'
];
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)]
  .map((match) => match[1]).sort().join('|');

test('dataset methodology matches the English Inlang source message', () => {
  // If the source methodology changes, every locale needs review alongside it.
  assert.equal(languageDataset.note, base.language_source_note);
});

test('all 13 Inlang catalogs translate app-authored language, gallery and section text', () => {
  assert.equal(locales.length, 13);
  for (const locale of locales) {
    const dictionary = JSON.parse(file('messages/' + locale + '.json'));
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(base).sort(), locale + ': catalog keys');
    for (const key of UI_MESSAGES) {
      assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), locale + ': ' + key);
      assert.equal(placeholders(dictionary[key]), placeholders(base[key]), locale + ': ' + key + ' placeholders');
    }
  }
});

test('visible app copy and gallery accessibility labels use Inlang, not English literals', () => {
  const languagePanel = file('src/lib/components/LanguagePanel.svelte');
  const gallery = file('src/lib/components/DestinationImage.svelte');
  const homepage = file('src/routes/+page.svelte');
  const summary = file('src/lib/components/AggregateSummary.svelte');
  assert.match(languagePanel, /m\.language_source_note\(\)/);
  assert.doesNotMatch(languagePanel, /\{data\.note\}/);
  assert.match(gallery, /m\.destination_gallery_close\(\)/);
  assert.match(gallery, /m\.destination_gallery_photos\(/);
  assert.match(gallery, /m\.destination_gallery_label\(/);
  assert.match(gallery, /m\.destination_gallery_carousel\(\)/);
  assert.doesNotMatch(gallery, /Close image gallery|['"] · gallery['"]|['"] photos['"]/);
  for (const source of [homepage, summary]) {
    assert.doesNotMatch(source, />\s*(INDONESIA|OBSERVATORY)\s*<\/span>/);
  }
});

test('all user-visible island-group labels resolve through translated messages', () => {
  const helper = file('src/lib/i18n/island-groups.ts');
  for (const name of ['sumatra', 'java', 'nusa_tenggara', 'kalimantan', 'sulawesi', 'maluku', 'papua']) {
    assert.ok(helper.includes('m.island_group_' + name), name);
  }
  for (const path of ['IslandChart', 'ProvinceTable', 'ClayMap', 'HeroArchipelago']) {
    const source = file('src/lib/components/' + path + '.svelte');
    assert.match(source, /islandGroupLabel\(/, path);
    assert.doesNotMatch(source, /ISLAND_GROUP_NAMES/, path);
  }
});

test('all four share card variants require the localized visit label', () => {
  const renderer = file('src/lib/share/card.ts');
  const panel = file('src/lib/components/SharePanel.svelte');
  assert.doesNotMatch(renderer, /Explore the atlas/);
  assert.equal((renderer.match(/visitLabel: string;/g) ?? []).length, 4);
  assert.ok((panel.match(/m\.share_visit_cta\(\)/g) ?? []).length >= 4);
});
