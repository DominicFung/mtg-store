import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { PNG } from 'pngjs';
import { renderBlendedRgba } from './colourCore';
import { settingsFromPrintDescription } from './printDescription';

function meanChannelDelta(left: Uint8Array, right: Uint8Array): number {
  const pixels = left.length / 4;
  let absolute = 0;
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    absolute += Math.abs(left[offset] - right[offset]);
    absolute += Math.abs(left[offset + 1] - right[offset + 1]);
    absolute += Math.abs(left[offset + 2] - right[offset + 2]);
  }
  return absolute / (pixels * 3);
}

describe('left face colour blend', () => {
  it('stays close to the expected pastel stack for the example filaments', () => {
    const description = readFileSync(new URL('../fixtures/left-3.txt', import.meta.url), 'utf8');
    const settings = settingsFromPrintDescription(description);
    const source = PNG.sync.read(readFileSync(new URL('../../../web/public/examples/winter-dogs/left-3.png', import.meta.url)));
    const expected = PNG.sync.read(readFileSync(new URL('../fixtures/expected-left-3.png', import.meta.url)));
    const rendered = renderBlendedRgba({
      rgba: source.data,
      width: source.width,
      height: source.height,
      modelWidthMm: settings.width,
      modelHeightMm: settings.height,
      stops: settings.stops,
      settings,
    });
    const resized = new Uint8Array(source.width * source.height * 4);
    for (let y = 0; y < source.height; y += 1) {
      const sourceY = Math.min(expected.height - 1, Math.floor((y + 0.5) * expected.height / source.height));
      for (let x = 0; x < source.width; x += 1) {
        const sourceX = Math.min(expected.width - 1, Math.floor((x + 0.5) * expected.width / source.width));
        const from = (sourceY * expected.width + sourceX) * 4;
        const to = (y * source.width + x) * 4;
        resized[to] = expected.data[from];
        resized[to + 1] = expected.data[from + 1];
        resized[to + 2] = expected.data[from + 2];
        resized[to + 3] = 255;
      }
    }
    const mean = meanChannelDelta(rendered, resized);
    expect(mean).toBeLessThan(12);
  });
});
