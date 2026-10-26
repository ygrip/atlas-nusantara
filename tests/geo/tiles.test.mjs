import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROVINCE_TILES, TILE_COLUMNS, TILE_ROWS } from '../../src/lib/atlas/tiles.ts';

test('schematic tiles cover exactly the 37 provinces of the 2022 edition, one cell each', async () => {
  const provinces = JSON.parse(await readFile('static/data/admin-2022/provinces.json', 'utf8'));
  const provinceCodes = provinces.regions.map(region => region.code).sort();
  const tileCodes = PROVINCE_TILES.map(tile => tile.code).sort();
  const cells = new Set(PROVINCE_TILES.map(tile => tile.column + ':' + tile.row));
  const abbreviations = new Set(PROVINCE_TILES.map(tile => tile.abbreviation));

  assert.deepEqual(tileCodes, provinceCodes);
  assert.equal(cells.size, PROVINCE_TILES.length, 'tiles must not overlap');
  assert.equal(abbreviations.size, PROVINCE_TILES.length, 'abbreviations must be unique');
  assert.ok(PROVINCE_TILES.every(tile => tile.column >= 1 && tile.column <= TILE_COLUMNS && tile.row >= 1 && tile.row <= TILE_ROWS));
});
