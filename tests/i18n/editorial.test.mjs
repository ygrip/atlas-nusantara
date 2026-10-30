import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BASE_LOCALE, PREFIXED_LOCALES, localizedPath } from '../../src/lib/i18n/paths.js';

const languages = [BASE_LOCALE, ...PREFIXED_LOCALES];
const slugs = ['regions', 'conditions', 'nature'];
const keys = ['nav_about', 'nav_guides', 'breadcrumb_label', 'back', 'about_label', 'guide_label', 'open_atlas', 'all_guides', 'more_guides', 'index_title', 'index_description', 'index_body', 'about_title', 'about_description', 'about_body', ...slugs.flatMap(slug => [slug + '_title', slug + '_description', slug + '_body'])].map(key => 'editorial_' + key);
const catalog = locale => JSON.parse(readFileSync('messages/' + locale + '.json', 'utf8'));

test('new editorial pages have content and complete Paraglide keys in all 13 languages', () => {
  assert.equal(languages.length, 13);
  for (const locale of languages) {
    const messages = catalog(locale);
    for (const key of keys) {
      assert.equal(typeof messages[key], 'string', locale + ': ' + key);
      assert.ok(messages[key].trim(), locale + ': ' + key + ' empty');
    }
    for (const slug of ['about', ...slugs]) {
      const body = messages['editorial_' + slug + '_body'];
      assert.ok((body.match(/^## /gm) ?? []).length >= 5, locale + '/' + slug + ': expected practical worked example and source sections');
      assert.ok(body.split(/\n\s*\n/).length >= 10, locale + '/' + slug + ': missing sections or explanatory paragraphs');
      assert.match(body, /https:\/\/github\.com\/ygrip\/atlas-nusantara\/blob\/main\/docs\//);
      assert.doesNotMatch(body, /<script\b|\{@html/i, locale + '/' + slug + ': untrusted HTML');
    }
    assert.equal((messages.editorial_about_body.match(/^### /gm) ?? []).length, 3, locale + ': FAQ');
    assert.equal(new Set(slugs.map(slug => messages['editorial_' + slug + '_title'])).size, slugs.length);
    for (const slug of slugs) assert.equal(localizedPath('/guides/' + slug, locale), (locale === 'en' ? '' : '/' + locale) + '/guides/' + slug);
  }
});

test('prerendering and sitemap both include every editorial route', () => {
  const config = readFileSync('svelte.config.js', 'utf8');
  const staticScript = readFileSync('scripts/prepare-static.mjs', 'utf8');
  for (const route of ['/about', '/guides', ...slugs.map(slug => '/guides/' + slug)]) {
    assert.ok(config.includes("'" + route + "'"), 'missing prerender route ' + route);
    assert.ok(staticScript.includes("'" + route.slice(1) + "'"), 'missing sitemap route ' + route);
  }
});
