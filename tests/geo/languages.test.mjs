import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isLanguageData, languageClassIndex, rankProvinces } from '../../src/lib/data/languages-contract.ts';

const data = JSON.parse(await readFile('static/data/observations/languages.json', 'utf8'));

test('the language file passes its own contract and covers every atlas province', () => {
  assert.equal(isLanguageData(data), true);
  assert.equal(data.provinces.length, 38);
  assert.equal(data.totalLanguages, 718);
  assert.deepEqual(data.unplacedLanguages, []);
});

test('the 2022 Papua split gives each new province its own languages', () => {
  const counts = new Map(data.provinces.map(province => [province.code, province.count]));
  for (const code of ['91', '92', '93', '94', '95', '96']) assert.ok(counts.get(code) > 0, 'province ' + code);
  assert.ok(counts.get('93') > 1, 'Papua Selatan is not folded into one language');
  assert.equal(rankProvinces(data)[0].code, '91');
});

test('the contract rejects counts that do not match their language lists', () => {
  assert.equal(isLanguageData({ ...data, provinces: [{ code: '11', count: 3, languages: ['Aceh'] }] }), false);
  assert.equal(isLanguageData({ ...data, kind: 'population' }), false);
  assert.equal(isLanguageData({ ...data, sourceUrl: 'javascript:1' }), false);
});

for (const [count, expected] of [[1, 0], [5, 0], [6, 1], [12, 1], [13, 2], [30, 2], [31, 3], [70, 3], [71, 4], [152, 4]]) {
  test(`${count} languages falls in heat class ${expected}`, () => {
    assert.equal(languageClassIndex(count), expected);
  });
}
