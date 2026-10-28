import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const geometryPath = join(root, 'static/illustrations/atlas-anatomy.svg');
const geometry = readFileSync(geometryPath, 'utf8');
const hero = readFileSync(join(root, 'src/lib/components/HeroArchipelago.svelte'), 'utf8');
const page = readFileSync(join(root, 'src/routes/+page.svelte'), 'utf8');
const groups = ['sumatra', 'java', 'nusa-tenggara', 'kalimantan', 'sulawesi', 'maluku', 'papua'];
const ornaments = ['flag', 'volcano', 'orangutan', 'komodo', 'pinisi', 'cendrawasih'];

test('archipelago silhouettes use seven shared geographic groups in one projection', () => {
  for (const group of groups) assert.ok(geometry.includes('<g id="' + group + '">'), group);
  assert.equal((geometry.match(/<g id="/g) ?? []).length, 7);
  assert.ok(geometry.includes('viewBox="0 0 1000 500"'));
  assert.equal((geometry.match(/<path /g) ?? []).length, 38);
  assert.ok(page.includes('<HeroArchipelago alt={m.hero_art_alt()} />'));
});

test('hero geometry and clay cutouts stay light', () => {
  assert.ok(statSync(geometryPath).size < 130 * 1024, 'simplified geometry under 130 KB');
  for (const ornament of ornaments) {
    const file = join(root, 'static/illustrations/hero', ornament + '.webp');
    assert.ok(existsSync(file), ornament);
    assert.ok(statSync(file).size < 40 * 1024, ornament + ' under 40 KB');
  }
});

test('hero motion is CSS-only, pauses offscreen and honors reduced motion', () => {
  assert.ok(hero.includes('prefers-reduced-motion'));
  assert.ok(hero.includes('IntersectionObserver'));
  assert.ok(!/gsap|requestAnimationFrame|pointermove|mousemove|:hover/.test(hero));
  assert.ok(!hero.includes('FIG.'));
});
