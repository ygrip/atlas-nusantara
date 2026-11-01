import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HISTORY_EVENTS, HISTORY_MIN_YEAR } from '../../src/lib/data/history.ts';

const LOCALES = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL', 'ja'];
const REGION_KEYS = ['sumatra', 'java', 'bali', 'borneo', 'sulawesi', 'nusa_tenggara', 'maluku', 'papua', 'malay_peninsula', 'archipelago']
  .map(region => 'history_region_' + region);
const eventKey = year => 'history_event_' + (year < 0 ? 'bce' + Math.abs(year) : year);
const requiredKeys = [
  ...REGION_KEYS,
  ...HISTORY_EVENTS.map(event => eventKey(event.year)),
  'history_era_bce', 'history_era_ce', 'history_unknown_rulers', 'history_ruler_uncertain',
  'history_date_note_generic', 'history_summary_template', 'history_catalogue_scope',
  'history_search', 'history_search_hint', 'history_scope', 'history_search_empty',
  'history_scope_active', 'history_scope_all', 'history_research_badge', 'history_adapted',
  'history_inventory', 'history_inventory_note', 'history_inventory_empty', 'history_export_detail',
  'history_research_detail', 'history_dates_unknown', 'history_evidence_warning', 'history_reported_fields', 'history_genealogy_source', 'history_catalogue_incomplete'
];

async function messagesFor(locale) {
  return JSON.parse(await readFile(new URL('../../messages/' + locale + '.json', import.meta.url), 'utf8'));
}

test('history regions, milestones and templates exist in all 14 locales', async () => {
  assert.equal(HISTORY_EVENTS[0].year, HISTORY_MIN_YEAR);
  for (const locale of LOCALES) {
    const messages = await messagesFor(locale);
    for (const key of requiredKeys) {
      assert.equal(typeof messages[key], 'string', locale + ' is missing ' + key);
      assert.ok(messages[key].trim().length > 0, locale + ' has an empty ' + key);
    }
  }
});

test('translated history strings keep their placeholders and are not copied from English', async () => {
  const english = await messagesFor('en');
  assert.match(english.history_summary_template, /\{name\}.*\{place\}.*\{period\}.*\{rulers\}/);
  for (const locale of LOCALES.filter(code => code !== 'en')) {
    const messages = await messagesFor(locale);
    for (const placeholder of ['{name}', '{place}', '{period}', '{rulers}']) {
      assert.ok(messages.history_summary_template.includes(placeholder), locale + ' template lost ' + placeholder);
    }
    assert.ok(messages.history_era_ce.includes('{year}') && messages.history_era_bce.includes('{year}'), locale + ' era lost {year}');
    for (const key of ['history_event_1928', 'history_event_1873',
      'history_search', 'history_search_hint', 'history_scope', 'history_search_empty',
      'history_scope_active', 'history_scope_all', 'history_research_badge', 'history_adapted',
      'history_inventory', 'history_inventory_note', 'history_inventory_empty', 'history_export_detail',
      'history_research_detail', 'history_dates_unknown', 'history_evidence_warning', 'history_reported_fields', 'history_genealogy_source', 'history_catalogue_incomplete']) {
      if (key.startsWith('history_event_') && ['ms', 'fil', 'tet', 'pt-TL'].includes(locale)) continue;
      assert.notEqual(messages[key], english[key], locale + ' left English text in ' + key);
    }
  }
});
