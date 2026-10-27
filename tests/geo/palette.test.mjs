import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const css = readFileSync(new URL('../../src/app.css', import.meta.url), 'utf8');
const chrome = readFileSync(new URL('../../src/app.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../static/manifest.webmanifest', import.meta.url), 'utf8'));

function rgb(hex) {
  const bytes = hex.slice(1).match(/.{2}/g).map(v => parseInt(v, 16) / 255);
  return bytes.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
}
function contrast(a, b) {
  const luminance = h => rgb(h).reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function token(theme, name) {
  const match = theme.match(new RegExp('--' + name + ': (#[a-f0-9]{6})', 'i'));
  assert.ok(match, 'Missing token ' + name);
  return match[1];
}

test('Merah Putih light and dark primary actions meet WCAG AA text contrast', () => {
  const [light, dark] = css.split(":root[data-theme='dark']");
  for (const theme of [light, dark]) {
    assert.ok(contrast(token(theme, 'on-accent'), token(theme, 'accent')) >= 4.5);
    assert.ok(contrast(token(theme, 'text'), token(theme, 'surface')) >= 4.5);
    for (const name of ['red-wash', 'green-wash', 'gold-wash']) {
      assert.match(theme, new RegExp('--' + name + ': #[a-f0-9]{6}', 'i'));
    }
  }
});

test('Browser chrome and installed app match the light porcelain background', () => {
  assert.equal(manifest.theme_color, '#f8f5f3');
  assert.equal(manifest.background_color, '#f8f5f3');
  assert.ok(chrome.includes('content="#f8f5f3"'));
});
