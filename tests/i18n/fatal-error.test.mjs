import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildFatalErrorFallback, FATAL_KEYS } from '../../scripts/generate-fatal-error.mjs';

test('the standalone error document stays synchronized with all 13 Inlang catalogs', async () => {
  const { html, script, translations, hash } = await buildFatalErrorFallback();
  assert.equal(html, await readFile(new URL('../../src/error.html', import.meta.url), 'utf8'));
  assert.equal(Object.keys(translations).length, 13);
  for (const [locale, copy] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(copy).sort(), [...FATAL_KEYS].sort(), locale);
    assert.ok(FATAL_KEYS.every(key => copy[key].trim()), locale + ': nonempty fatal messages');
  }
  assert.ok(script.includes('location.pathname.split("/")[1]'));
  assert.ok(script.includes('textContent'));
  assert.ok(script.includes('locale + "/"'));
  assert.equal(createHash('sha256').update(script).digest('base64'), hash);
  assert.ok(html.includes("'sha256-" + hash + "'"));
  assert.doesNotMatch(html, /%%FATAL_/);
  assert.doesNotMatch(html, /script-src[^;"']*unsafe-inline/);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=/);
});
