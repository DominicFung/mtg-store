import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXAMPLE_LAYER_IDS, EXAMPLE_TD, exampleEndLayers, exampleLayers, exampleStartDepths } from './exampleDesign';
import { MOCK_FILAMENTS } from './filamentCatalogue';
import { layerTopMm } from './colourCore';

const settings = { baseLayerHeight: 0.09, layerHeight: 0.04 };

test('the example stack matches the preset layers and transmission distances', () => {
  const layers = exampleLayers(MOCK_FILAMENTS);
  assert.deepEqual(layers.map((layer) => layer.id), [...EXAMPLE_LAYER_IDS]);
  assert.deepEqual(layers.map((layer) => layer.td), EXAMPLE_LAYER_IDS.map((id) => EXAMPLE_TD[id]));
  assert.equal(layers[0]?.name, 'Elegoo PLA Black');
  assert.equal(layers[1]?.name, 'Polyterra PLA Wood Brown');
  assert.equal(layers[2]?.name, 'Elegoo PLA Dark Blue');
  assert.equal(layers[3]?.name, 'Elegoo Matte PLA Lavender Purple');
  assert.equal(layers[4]?.name, 'Elegoo PLA Beige');
  assert.equal(layers[5]?.name, 'Elegoo Matte PLA Sakura Pink');
  assert.equal(layers[6]?.name, 'Deeplee Matte White');
  assert.equal(layers[6]?.brand, 'Deeplee');
  assert.equal(layers[6]?.finish, 'matte');
  assert.deepEqual(exampleEndLayers(50), [2, 5, 12, 17, 34, 38, 50]);
  const starts = exampleStartDepths(settings);
  assert.deepEqual(starts.map((depth) => Number(depth.toFixed(2))), [0.09, 0.17, 0.29, 0.57, 0.77, 1.45, 1.61]);
  assert.equal(layerTopMm(2, settings), 0.13);
});

test('the filament seed contains Deeplee Matte White and every other catalogue row', () => {
  const seed = JSON.parse(readFileSync(new URL('../../../aws/seeds/filaments.json', import.meta.url), 'utf8')) as Array<{ filamentId: string; name: string; td: number }>;
  const seedIds = new Set(seed.map((row) => row.filamentId));
  for (const filament of MOCK_FILAMENTS) {
    assert.equal(seedIds.has(filament.id), true, filament.id);
  }
  const white = seed.find((row) => row.filamentId === 'deeplee-matte-white');
  assert.equal(white?.name, 'Deeplee Matte White');
  assert.equal(white?.td, 5);
});
