import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { profileToSettings, LAUNCH_PROFILES } from '../../../packages/print-core/src/profiles';
import { decodeBinaryStl } from '../../../packages/print-core/src/printGeometry';
import { hexToRgb, type CoreStop } from '../../../packages/print-core/src/hueforge';
import { buildOrderZip } from './archive';

function pngOf(width: number, height: number, bright: boolean): Uint8Array {
  const png = new PNG({ width, height });
  for (let index = 0; index < width * height; index += 1) {
    const value = bright ? 240 : 10;
    png.data[index * 4] = value;
    png.data[index * 4 + 1] = value;
    png.data[index * 4 + 2] = value;
    png.data[index * 4 + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

test('the generator zip is full resolution and uses the shared mesh', async () => {
  const settings = profileToSettings(LAUNCH_PROFILES[0]);
  const bytes = pngOf(12, 16, true);
  const png = PNG.sync.read(Buffer.from(bytes));
  const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  const stops: CoreStop[] = [
    { filament: { type: 'PLA', brand: 'Test', name: 'Blue', td: 4 }, rgb: hexToRgb('#2244AA'), endLayer: 50 },
  ];
  const zipBytes = await buildOrderZip({
    orderNumber: 'MR-AAAAAAAA',
    settings,
    stops,
    faces: (['front', 'spine', 'back'] as const).map((name) => ({
      name,
      rgba,
      width: png.width,
      height: png.height,
      cropPng: bytes,
    })),
  });
  const zip = await JSZip.loadAsync(zipBytes);
  for (const face of ['front', 'spine', 'back']) {
    const stl = await zip.file(`${face}.stl`)?.async('uint8array');
    assert.ok(stl && stl.byteLength > 84);
    const triangles = decodeBinaryStl(stl);
    assert.ok(triangles.length > 10);
    const details = await zip.file(`${face}-details.txt`)?.async('string');
    assert.match(details ?? '', new RegExp(`MR-AAAAAAAA-${face}.hfp`));
  }
  assert.ok(zip.file('crop-1.png'));
  assert.ok(zip.file('layered-3.png'));
  const manifest = JSON.parse(await zip.file('filament-layers.json')!.async('string')) as { print: { triangleCap: null; layerCount: number } };
  assert.equal(manifest.print.triangleCap, null);
  assert.equal(manifest.print.layerCount, 50);
});
