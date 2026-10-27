import test from 'node:test';
import assert from 'node:assert/strict';
import { clayPinDocument, clayPinInner, clayPinKey, safeClayColor, shadeColor } from '../../src/lib/map/clay-pin.ts';

test('shadeColor blends towards white or black and keeps a valid hex colour', () => {
  assert.equal(shadeColor('#808080', 1), '#ffffff');
  assert.equal(shadeColor('#808080', -1), '#000000');
  assert.equal(shadeColor('#ca5a48', 0), '#ca5a48');
});

test('unsafe colours never reach the SVG markup', () => {
  const unsafe = 'red" onload="alert(1)';
  assert.equal(safeClayColor(unsafe), '#8a7f78');
  const markup = clayPinInner('circle', unsafe, 'x');
  assert.equal(markup.includes('onload'), false);
  assert.equal(markup.includes('#8a7f78'), true);
});

for (const symbol of ['circle', 'triangle', 'diamond']) {
  test(`clay ${symbol} marker is a shaded SVG with a unique gradient id`, () => {
    const markup = clayPinInner(symbol, '#2f7fc1', 'one');
    assert.match(markup, /<radialGradient id="clay-body-one"/);
    assert.match(markup, /fill="url\(#clay-body-one\)"/);
    const document = clayPinDocument(symbol, '#2f7fc1', 128);
    assert.match(document, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="128"/);
  });
}

test('marker cache key ignores colour case but separates symbols', () => {
  assert.equal(clayPinKey('circle', '#ABCDEF'), clayPinKey('circle', '#abcdef'));
  assert.notEqual(clayPinKey('circle', '#abcdef'), clayPinKey('diamond', '#abcdef'));
});
