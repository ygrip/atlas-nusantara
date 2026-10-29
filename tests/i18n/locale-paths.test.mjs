import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BASE_LOCALE, PREFIXED_LOCALES, localizedPath, stripLocalePrefix } from '../../src/lib/i18n/paths.js';

test('prefixed locales match the Paraglide project', () => {
  const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));
  assert.equal(settings.baseLocale, BASE_LOCALE);
  assert.deepEqual([BASE_LOCALE, ...PREFIXED_LOCALES].sort(), [...settings.locales].sort());
});

test('locale prefixes are stripped only as whole leading segments', () => {
  const cases = [
    ['/', '/'], ['/id', '/'], ['/id/', '/'], ['/id/terms', '/terms'], ['/zh-SG/privacy', '/privacy'],
    ['/terms', '/terms'], ['/idea', '/idea'], ['/privacy/id', '/privacy/id']
  ];
  for (const [input, expected] of cases) assert.equal(stripLocalePrefix(input), expected, input);
});

test('localizedPath swaps the language and keeps the route and hash', () => {
  const cases = [
    ['/', 'en', '/'], ['/', 'id', '/id'], ['/terms', 'id', '/id/terms'], ['/id/terms', 'en', '/terms'],
    ['/id/terms', 'th', '/th/terms'], ['/terms#sources', 'ms', '/ms/terms#sources'], ['/pt-TL', 'en', '/']
  ];
  for (const [path, locale, expected] of cases) assert.equal(localizedPath(path, locale), expected, path + ' -> ' + locale);
});

test('every language has a social preview image and its own copy', () => {
  const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));
  for (const locale of settings.locales) {
    const png = readFileSync('static/og/nusantara-' + locale + '.png');
    assert.equal(png.subarray(1, 4).toString(), 'PNG', locale + ' image is a PNG');
    assert.equal(png.readUInt32BE(16), 1200, locale + ' width');
    assert.equal(png.readUInt32BE(20), 630, locale + ' height');
    const text = JSON.parse(readFileSync('messages/' + locale + '.json', 'utf8'));
    for (const key of ['og_headline', 'og_tagline', 'og_description', 'og_cta', 'og_cities_regencies']) {
      assert.ok(text[key]?.trim(), locale + ' has ' + key);
    }
  }
});

test('the language of a path is its locale prefix, otherwise English', async () => {
  const { localeFromPathname } = await import('../../src/lib/i18n/paths.js');
  for (const [path, locale] of [['/', 'en'], ['/privacy', 'en'], ['/id', 'id'], ['/id/', 'id'], ['/km/terms', 'km'], ['/zh-SG/privacy', 'zh-SG'], ['/idx', 'en'], ['/pt-TL/', 'pt-TL']]) {
    assert.equal(localeFromPathname(path), locale);
  }
});
