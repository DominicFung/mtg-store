import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseColorCore } from '../../../packages/print-core/src/chooseColors';
import { extendToAspect, outpaintMargins, WRAP_ASPECT } from '../../../packages/print-core/src/outpaint';
import { profileToSettings, LAUNCH_PROFILES } from './printGeometry';

const settings = profileToSettings(LAUNCH_PROFILES[0]);

const catalogue = [
  { id: 'black', name: 'Black', hex: '#111111', td: 0.4, inStock: true },
  { id: 'blue', name: 'Blue', hex: '#2244AA', td: 4, inStock: true },
  { id: 'red', name: 'Red', hex: '#C4232B', td: 3.2, inStock: true },
  { id: 'white', name: 'White', hex: '#F4F1E8', td: 5, inStock: true },
];

function solid(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

test('a black-to-white plate gets a dark backing and a light top filament', () => {
  const choice = chooseColorCore({
    rgba: solid(24, 24, (_x, y) => (y < 12 ? [8, 8, 8] : [245, 245, 240])),
    width: 24,
    height: 24,
    filaments: catalogue,
    settings,
    count: 4,
  });
  assert.equal(choice.ids[0], 'black');
  assert.equal(choice.ids[choice.ids.length - 1], 'white');
  assert.equal(choice.endLayers[choice.endLayers.length - 1], 50);
  assert.ok(choice.endLayers.every((layer, index) => index === 0 || layer > choice.endLayers[index - 1]));
});

test('a red plate keeps red in the stack instead of painting it blue', () => {
  const choice = chooseColorCore({
    rgba: solid(16, 16, () => [200, 32, 40]),
    width: 16,
    height: 16,
    filaments: catalogue,
    settings,
    count: 3,
  });
  assert.ok(choice.ids.includes('red'));
  assert.ok(choice.ids.filter((id) => id === 'blue').length < choice.ids.length);
});

test('edge extend widens a portrait crop to the three-face frame and does not invent a border mesh', () => {
  const rgba = solid(40, 50, () => [20, 40, 80]);
  const extended = extendToAspect({ rgba, width: 40, height: 50 }, WRAP_ASPECT);
  assert.ok(extended.width / extended.height > WRAP_ASPECT - 0.02);
  assert.ok(Math.abs(extended.width / extended.height - WRAP_ASPECT) < 0.02);
  assert.equal(extended.rgba[(Math.floor(extended.height / 2) * extended.width + Math.floor(extended.width / 2)) * 4], 20);
  const margins = outpaintMargins(40, 50);
  assert.equal(margins.up, 0);
  assert.equal(margins.down, 0);
  assert.ok(margins.left > 0 && margins.right > 0);
  assert.ok(margins.left <= 2000 && margins.right <= 2000);
  assert.equal(outpaintMargins(841, 326).left, 0);
});
