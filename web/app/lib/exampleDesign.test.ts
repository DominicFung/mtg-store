import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DRAGON_BOX_FILAMENT_ID,
  DRAGON_MAX_DEPTH,
  DRAGON_LAYER_IDS,
  DRAGON_TD,
  EXAMPLE_BOX_FILAMENT_ID,
  EXAMPLE_LAYER_IDS,
  EXAMPLE_LOGO_FILAMENT_ID,
  EXAMPLE_TD,
  EXAMPLE_TEXT_FILAMENT_ID,
  dragonEndLayers,
  dragonLayers,
  dragonStartDepths,
  exampleEndLayers,
  exampleLayers,
  exampleStartDepths,
} from './exampleDesign';
import { DEFAULT_BOX_FILAMENT_ID, DEFAULT_LOGO_FILAMENT_ID, DEFAULT_TEXT_FILAMENT_ID } from '../box/lidFinish';
import { MOCK_FILAMENTS } from './filamentCatalogue';
import { hexToRgb, layerTopMm } from './colourCore';
import { modelSizeForCrop } from './printGeometry';

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

test('the example lid defaults to sakura pink and the closest catalogue white', () => {
  const distance = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return Math.hypot(255 - r, 255 - g, 255 - b);
  };
  const catalogue = exampleLayers(MOCK_FILAMENTS);
  const white = catalogue.find((filament) => filament.id === EXAMPLE_LOGO_FILAMENT_ID);
  assert.ok(white);
  for (const filament of MOCK_FILAMENTS) {
    assert.ok(distance(white.hex) <= distance(filament.hex), filament.id);
  }
  assert.equal(EXAMPLE_BOX_FILAMENT_ID, 'elegoo-matte-pla-sakura-pink');
  assert.equal(EXAMPLE_LOGO_FILAMENT_ID, 'deeplee-matte-white');
  assert.equal(EXAMPLE_TEXT_FILAMENT_ID, EXAMPLE_LOGO_FILAMENT_ID);
  assert.equal(white.name, 'Deeplee Matte White');
  assert.equal(DEFAULT_BOX_FILAMENT_ID, 'elegoo-pla-black');
  assert.equal(DEFAULT_LOGO_FILAMENT_ID, 'elegoo-pla-red');
  assert.equal(DEFAULT_TEXT_FILAMENT_ID, 'deeplee-matte-white');
});

test('red dragon skips to a black shell and the fire swaps', () => {
  const layers = dragonLayers(MOCK_FILAMENTS);
  assert.deepEqual(layers.map((layer) => layer.id), [...DRAGON_LAYER_IDS]);
  assert.deepEqual(layers.map((layer) => layer.td), DRAGON_LAYER_IDS.map((id) => DRAGON_TD[id]));
  assert.equal(layers[0]?.name, 'Elegoo PLA Black');
  assert.equal(layers[0]?.td, 0.5);
  assert.equal(layers[1]?.name, 'Elegoo PLA Pro Burgundy Red');
  assert.equal(layers[1]?.td, 2);
  assert.equal(layers[2]?.name, 'Elegoo PLA Red');
  assert.equal(layers[2]?.td, 3.4);
  assert.equal(layers[3]?.name, '3DHoJor PLA Orange');
  assert.equal(layers[3]?.td, 5);
  assert.equal(layers[4]?.name, 'Elegoo Matte PLA Sunshine Yellow');
  assert.equal(layers[4]?.td, 6.2);
  assert.equal(layers[5]?.id, 'deeplee-matte-white');
  assert.equal(layers[5]?.td, 5);
  assert.deepEqual(dragonEndLayers(50), [3, 18, 26, 30, 40, 50]);
  const starts = dragonStartDepths(settings);
  assert.deepEqual(starts.map((depth) => Number(depth.toFixed(2))), [0.09, 0.21, 0.81, 1.13, 1.29, 1.69]);
  assert.equal(DRAGON_BOX_FILAMENT_ID, 'elegoo-pla-black');
  assert.equal(DRAGON_MAX_DEPTH, 2.01);
  const header = (file: string) => {
    const bytes = readFileSync(new URL(`../../public/examples/red-dragon/${file}`, import.meta.url));
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };
  const right = header('right-1.png');
  const back = header('back-2.png');
  const left = header('left-3.png');
  assert.deepEqual(modelSizeForCrop(right.width, right.height, 105.45), { widthMm: 94.67, heightMm: 105.45 });
  assert.deepEqual(modelSizeForCrop(left.width, left.height, 105.45), { widthMm: 94.67, heightMm: 105.45 });
  assert.deepEqual(modelSizeForCrop(back.width, back.height, 105.45), { widthMm: 82.44, heightMm: 105.45 });
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
  const orange = seed.find((row) => row.filamentId === '3dhojor-pla-orange');
  assert.equal(orange?.name, '3DHoJor PLA Orange');
  assert.equal(orange?.td, 5);
  assert.equal(seed.some((row) => row.filamentId.startsWith('jessie-') || row.filamentId.startsWith('bambulab-')), false);
});
