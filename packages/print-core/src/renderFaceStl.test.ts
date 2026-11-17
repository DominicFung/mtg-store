import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { PNG } from 'pngjs';
import { meshTopMm } from './colourCore';
import { readGray16Png } from './heightmapPng';
import { rasterizeStlHeights, stlBounds } from './printGeometry';
import { renderFaceMesh } from './renderFaceStl';
import { settingsFromPrintDescription } from './printDescription';

const root = new URL('../', import.meta.url);
const images = new URL('../../../web/public/examples/winter-dogs/', import.meta.url);

const FACES = [
  {
    name: 'right',
    description: 'right-1.txt',
    image: 'right-1.png',
    heightmap: 'right.png',
    widthMm: 94.8,
    heightMm: 105.5,
    cols: 948,
    rows: 1055,
    triangles: 2012298,
  },
  {
    name: 'back',
    description: 'back-2.txt',
    image: 'back-2.png',
    heightmap: 'back.png',
    widthMm: 82.6,
    heightMm: 105.5,
    cols: 826,
    rows: 1055,
    triangles: 1754146,
  },
  {
    name: 'left',
    description: 'left-3.txt',
    image: 'left-3.png',
    heightmap: 'left.png',
    widthMm: 94.8,
    heightMm: 105.5,
    cols: 948,
    rows: 1055,
    triangles: 2012298,
  },
] as const;

function contrastPng(): Uint8Array {
  const png = new PNG({ width: 8, height: 8 });
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const value = x < 4 ? 0 : 255;
      const offset = (y * 8 + x) * 4;
      png.data[offset] = value;
      png.data[offset + 1] = value;
      png.data[offset + 2] = value;
      png.data[offset + 3] = 255;
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe('depth parameters', () => {
  it('reads layer height and depths from the description and lets a test override max depth', () => {
    const text = readFileSync(new URL('../fixtures/left-3.txt', import.meta.url), 'utf8');
    const parsed = settingsFromPrintDescription(text);
    expect(parsed.layerHeight).toBe(0.04);
    expect(parsed.baseLayerHeight).toBe(0.09);
    expect(parsed.minDepth).toBe(0.25);
    expect(parsed.maxDepth).toBe(2);
    const image = contrastPng();
    const atTwo = renderFaceMesh(image, parsed);
    const atTwoOhOne = renderFaceMesh(image, { ...parsed, maxDepth: 2.01 });
    expect(atTwo.actualDepthMm).toBeCloseTo(1.97, 5);
    expect(atTwoOhOne.actualDepthMm).toBeCloseTo(2.05, 5);
    expect(stlBounds(atTwo.stl).max[2]).toBeCloseTo(1.97, 2);
    expect(stlBounds(atTwoOhOne.stl).max[2]).toBeCloseTo(2.05, 2);
    expect(meshTopMm(parsed)).toBeCloseTo(1.97, 5);
    expect(meshTopMm({ ...parsed, maxDepth: 2.01 })).toBeCloseTo(2.05, 5);
  });
});

describe('STL from a print settings description', () => {
  it.each(FACES)('$name matches the plate size, depth, and swap stack', (face) => {
    const description = readFileSync(new URL(`fixtures/${face.description}`, root), 'utf8');
    const image = new Uint8Array(readFileSync(new URL(face.image, images)));
    const settings = settingsFromPrintDescription(description);
    const mesh = renderFaceMesh(image, settings);
    expect(mesh.widthMm).toBeCloseTo(face.widthMm, 5);
    expect(mesh.heightMm).toBeCloseTo(face.heightMm, 5);
    expect(mesh.cols).toBe(face.cols);
    expect(mesh.rows).toBe(face.rows);
    expect(mesh.triangles).toBe(face.triangles);
    expect(mesh.actualDepthMm).toBeCloseTo(meshTopMm(settings), 6);
    expect(mesh.actualDepthMm).toBeCloseTo(1.97, 5);
    expect(settings.stops.map((stop) => stop.endLayer)).toEqual([2, 5, 12, 17, 34, 38, 50]);
    const bounds = stlBounds(mesh.stl);
    expect(bounds.min[2]).toBeCloseTo(0, 4);
    expect(bounds.max[2]).toBeCloseTo(1.97, 3);
    expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(face.widthMm, 3);
    expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(face.heightMm, 3);

    const referencePath = new URL(`fixtures/heightmaps/${face.heightmap}`, root);
    if (!existsSync(referencePath)) {
      console.log(`skipping ${face.name} heightmap comparison; ${referencePath.pathname} is absent`);
      return;
    }
    const reference = readGray16Png(new Uint8Array(readFileSync(referencePath)));
    expect(reference.width).toBe(face.cols);
    expect(reference.height).toBe(face.rows);
    const heights = rasterizeStlHeights(mesh.stl, mesh.cols, mesh.rows, mesh.widthMm, mesh.heightMm);
    let absolute = 0;
    let worst = 0;
    let count = 0;
    for (let y = 0; y < face.rows; y += 1) {
      const j = face.rows - 1 - y;
      for (let i = 0; i < face.cols; i += 1) {
        const ours = heights[j * (face.cols + 1) + i];
        const ref = reference.values[y * face.cols + i] / 1000;
        const error = Math.abs(ours - ref);
        absolute += error;
        count += 1;
        if (error > worst) worst = error;
      }
    }
    const mean = absolute / count;
    expect(mean).toBeLessThan(0.02);
    expect(worst).toBeLessThan(0.4);
  });
});
