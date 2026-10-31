import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderDishShareCard } from '../../src/lib/share/card.ts';

test('cuisine badges keep one line and ellipsize long labels in both views', async () => {
  for (const name of ['CuisinePanel.svelte', 'CuisineDialog.svelte']) {
    const source = await readFile(new URL('../../src/lib/components/' + name, import.meta.url), 'utf8');
    assert.match(source, /\.group-badge\s*\{[^}]*white-space: nowrap;/);
    assert.match(source, /\.group-badge > span\s*\{[^}]*text-overflow: ellipsis;/);
    assert.match(source, /<span class="group-badge"[^>]*><span>\{cuisineGroupLabel\(dish.group\)\}<\/span><\/span>/);
  }
});

test('cuisine share cards draw a raised tinted chip with readable text in both themes', async () => {
  const idMessages = JSON.parse(await readFile(new URL('../../messages/id.json', import.meta.url), 'utf8'));
  const saved = new Map(['window', 'document', 'Image'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const theme of ['light', 'dark']) {
      const labels = [];
      const gradients = [];
      const dots = [];
      const images = [];
      const ctx = {
        fillStyle: '',
        strokeStyle: '',
        font: '',
        save() {},
        restore() {},
        scale() {},
        fillRect() {},
        beginPath() {},
        roundRect() {},
        clip() {},
        drawImage(image) { images.push(image.url); },
        fill() {},
        stroke() {},
        moveTo() {},
        lineTo() {},
        arc(x, y, radius) { dots.push({ x, y, radius }); },
        measureText(text) { return { width: text.length * 12 }; },
        fillText(text) { labels.push({ text, color: this.fillStyle }); },
        createLinearGradient(...coordinates) {
          const gradient = { coordinates, stops: [], addColorStop(position, color) { this.stops.push({ position, color }); } };
          gradients.push(gradient);
          return gradient;
        }
      };
      const canvas = { getContext: () => ctx, toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })) };
      globalThis.document = { fonts: { ready: Promise.resolve() }, documentElement: { dataset: { theme } }, createElement: () => canvas };
      globalThis.window = { devicePixelRatio: 1, setTimeout, clearTimeout };
      globalThis.Image = class {
        naturalWidth = 320;
        naturalHeight = 240;
        set src(url) { this.url = url; this.onload?.(); }
      };
      const blob = await renderDishShareCard({
        dish: {
          id: 'test-dish', name: 'Example cuisine', subtitle: 'Rice · Java',
          kindLabel: 'Cuisine', chipLabel: '2 recipes', chipColor: '#a9473a',
          description: 'Test description', placeholderUrl: '/illustration.svg', placeholderBackground: '#f5e1c8'
        },
        caveat: 'Test caveat',
        visitLabel: idMessages.share_visit_cta
      });
      assert.equal(blob.type, 'image/png');
      const label = labels.find(item => item.text === '2 recipes');
      assert.ok(label, 'the group or recipe label is drawn');
      assert.equal(label.color, theme === 'dark' ? '#f3e9de' : '#392f2b');
      const chipGradient = gradients.find(gradient => gradient.coordinates[0] === 96 && gradient.coordinates[1] > 600);
      assert.ok(chipGradient, 'the cuisine chip gets its own raised surface gradient');
      assert.equal(chipGradient.stops.length, 2);
      assert.notEqual(chipGradient.stops[0].color, '#a9473a', 'the solid category color is not the text background');
      assert.ok(images.includes('/brand/logo-256.png'), 'the export includes the atlas icon');
      for (const text of ['Atlas Nusantara', 'nusantara.readynaz.com', idMessages.share_visit_cta]) {
        assert.ok(labels.some(label => label.text === text), 'the export includes ' + text);
      }
      assert.ok(dots.some(item => item.radius === 5), 'the category remains visible as a small colored dot');
    }
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
