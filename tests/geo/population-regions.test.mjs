import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const DIRECTORY = 'static/data/observations/population-regions';
const files = (await readdir(DIRECTORY)).filter(name => name.endsWith('.json'));
const documents = await Promise.all(files.map(async name => JSON.parse(await readFile(DIRECTORY + '/' + name, 'utf8'))));
const population = JSON.parse(await readFile('static/data/observations/population.json', 'utf8'));

function total(counts) {
  return counts.male.reduce((sum, value) => sum + value, 0) + counts.female.reduce((sum, value) => sum + value, 0);
}

test('every province has a file with a pyramid for itself and each of its regencies and cities', () => {
  assert.equal(documents.length, 38);
  for (const document of documents) {
    assert.equal(document.kind, 'population-pyramid-regions');
    assert.equal(document.ageGroups.length, 16);
    assert.ok(document.regions[document.provinceCode], 'province row ' + document.provinceCode);
    for (const [code, counts] of Object.entries(document.regions)) {
      assert.ok(code.startsWith(document.provinceCode), code);
      assert.equal(counts.male.length, 16);
      assert.equal(counts.female.length, 16);
    }
  }
  assert.equal(documents.reduce((sum, document) => sum + Object.keys(document.regions).length, 0), 552);
});

test('regencies add up to their province and provinces match the BPS province table', () => {
  for (const document of documents) {
    const code = document.provinceCode;
    const regencies = Object.entries(document.regions).filter(([key]) => key !== code);
    const regencyTotal = regencies.reduce((sum, [, counts]) => sum + total(counts), 0);
    const provinceTotal = total(document.regions[code]);
    assert.ok(Math.abs(provinceTotal - regencyTotal) / provinceTotal < 0.001, 'regencies of ' + code);
    const published = population.provinces.find(item => item.code === code).years.find(item => item.year === document.year);
    assert.ok(Math.abs(provinceTotal / 1000 - published.population) / published.population < 0.002, 'province table for ' + code);
  }
});

test('the provinces add up to the national total of the same year', () => {
  const year = documents[0].year;
  const national = population.years.find(item => item.year === year).published.total;
  const provinces = documents.reduce((sum, document) => sum + total(document.regions[document.provinceCode]), 0) / 1000;
  assert.ok(Math.abs(provinces - national) < 1, provinces + ' vs ' + national);
});
