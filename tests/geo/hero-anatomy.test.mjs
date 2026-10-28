import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const geometry = readFileSync(join(root, 'static/illustrations/atlas-anatomy.svg'), 'utf8');
const hero = readFileSync(join(root, 'src/lib/components/HeroArchipelago.svelte'), 'utf8');
const page = readFileSync(join(root, 'src/routes/+page.svelte'), 'utf8');
const groups = ['sumatra', 'java', 'nusa-tenggara', 'kalimantan', 'sulawesi', 'maluku', 'papua'];
const ornaments = ['rafflesia', 'flag', 'volcano', 'orangutan', 'palm', 'komodo', 'pinisi', 'cendrawasih'];

test('archipelago silhouettes use seven shared geographic groups', () => {
  for (const group of groups) assert.ok(geometry.includes('<g id="' + group + '">'), group);
  assert.equal((geometry.match(/<g id="/g) ?? []).length, 7);
  assert.ok(geometry.includes('viewBox="0 0 1000 500"'));
  assert.ok(geometry.includes('data-code="11"'));
  assert.ok(geometry.includes('data-code="94"'));
  assert.ok(hero.includes('prefers-reduced-motion'));
  assert.ok(hero.includes('IntersectionObserver'));
  assert.ok(page.includes('<HeroArchipelago alt={m.hero_art_alt()} />'));
});

test('eight local fal.ai ornament cutouts are present', () => {
  for (const ornament of ornaments) {
    assert.ok(existsSync(join(root, 'static/illustrations/anatomy', ornament + '.webp')), ornament);
  }
});
