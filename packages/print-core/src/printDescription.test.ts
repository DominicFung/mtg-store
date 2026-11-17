import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { layerTopMm } from './colourCore';
import { parsePrintDescription, settingsFromPrintDescription } from './printDescription';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

const SWAP_LAYERS = [
  { layer: 2, depth: 0.13, to: 'Dark Brown' },
  { layer: 5, depth: 0.25, to: 'Blue' },
  { layer: 12, depth: 0.53, to: 'Lilac Purple' },
  { layer: 17, depth: 0.73, to: 'Beige' },
  { layer: 34, depth: 1.41, to: 'Pink' },
  { layer: 38, depth: 1.57, to: 'Jade White' },
];

const LIBRARY = [
  ['elegoo-pla-black', 'Elegoo PLA Black', 0.3],
  ['polyterra-pla-wood-brown', 'Polyterra PLA Wood Brown', 2],
  ['elegoo-pla-dark-blue', 'Elegoo PLA Dark Blue', 4],
  ['elegoo-matte-pla-lavender-purple', 'Elegoo Matte PLA Lavender Purple', 2],
  ['elegoo-pla-beige', 'Elegoo PLA Beige', 8],
  ['elegoo-matte-pla-sakura-pink', 'Elegoo Matte PLA Sakura Pink', 12],
  ['deeplee-matte-white', 'Deeplee Matte White', 5],
] as const;

function expectExample(text: string, project: string, width: number) {
  const parsed = parsePrintDescription(text);
  expect(parsed.projectName).toBe(project);
  expect(parsed.layerHeightMm).toBe(0.04);
  expect(parsed.baseLayerMm).toBe(0.09);
  expect(parsed.widthMm).toBe(width);
  expect(parsed.heightMm).toBe(105.45);
  expect(parsed.minDepthMm).toBe(0.25);
  expect(parsed.maxDepthMm).toBe(2);
  expect(parsed.actualDepthMm).toBe(2);
  expect(parsed.startShortName).toBe('Black');
  expect(parsed.filaments.map((filament) => filament.libraryId)).toEqual(LIBRARY.map((row) => row[0]));
  expect(parsed.filaments.map((filament) => filament.libraryName)).toEqual(LIBRARY.map((row) => row[1]));
  expect(parsed.filaments.map((filament) => filament.td)).toEqual(LIBRARY.map((row) => row[2]));
  expect(parsed.swaps).toEqual(SWAP_LAYERS.map((swap) => ({
    endLayer: swap.layer,
    depthMm: swap.depth,
    toShortName: swap.to,
  })));
  const settings = { layerHeight: 0.04, baseLayerHeight: 0.09 };
  for (const swap of parsed.swaps) {
    expect(layerTopMm(swap.endLayer, settings)).toBeCloseTo(swap.depthMm, 2);
  }
  expect(parsed.filaments.map((filament) => filament.endLayer)).toEqual([2, 5, 12, 17, 34, 38, 50]);
  const render = settingsFromPrintDescription(text);
  expect(render.detailSize).toBe(0.1);
  expect(render.stops.map((stop) => stop.endLayer)).toEqual([2, 5, 12, 17, 34, 38, 50]);
  expect(render.stops[0]?.filament.td).toBe(0.3);
  expect(render.stops[6]?.filament.name).toBe('Deeplee Matte White');
}

describe('print settings description', () => {
  it('reads the left face and maps every filament onto the shop library', () => {
    expectExample(fixture('left-3.txt'), 'Left-3.hfp', 94.8);
  });

  it('reads the right face from the same stack', () => {
    expectExample(fixture('right-1.txt'), 'Right-1.hfp', 94.8);
  });

  it('reads the back face at 82.6 mm wide', () => {
    expectExample(fixture('back-2.txt'), 'Back-2.hfp', 82.6);
  });

  it('refuses a filament that is not in the library map', () => {
    const text = fixture('left-3.txt').replace('PETG JAYO Black', 'PLA Unknown Copper');
    expect(() => parsePrintDescription(text)).toThrow(/No library filament/);
  });
});
