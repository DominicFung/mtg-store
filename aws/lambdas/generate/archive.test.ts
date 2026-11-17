import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { profileToSettings, LAUNCH_PROFILES } from '../../../packages/print-core/src/profiles';
import { decodeBinaryStl } from '../../../packages/print-core/src/printGeometry';
import { hexToRgb, type CoreStop } from '../../../packages/print-core/src/colourCore';
import { buildOrderZip } from './archive';
import { buildLidPrint } from './lidPrint';

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
    faces: (['left', 'spine', 'right'] as const).map((name) => ({
      name,
      rgba,
      width: png.width,
      height: png.height,
      cropPng: bytes,
    })),
  });
  const zip = await JSZip.loadAsync(zipBytes);
  for (const face of ['left', 'spine', 'right']) {
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
  assert.equal(zip.file('lid-base.stl'), null);
});

test('lid files are added beside the face plates and the face mesh is unchanged', async () => {
  const settings = profileToSettings(LAUNCH_PROFILES[0]);
  const bytes = pngOf(12, 16, true);
  const png = PNG.sync.read(Buffer.from(bytes));
  const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  const stops: CoreStop[] = [
    { filament: { type: 'PLA', brand: 'Test', name: 'Blue', td: 4 }, rgb: hexToRgb('#2244AA'), endLayer: 50 },
  ];
  const faces = (['front', 'spine', 'back'] as const).map((name) => ({
    name,
    rgba,
    width: png.width,
    height: png.height,
    cropPng: bytes,
  }));
  const plain = await buildOrderZip({ orderNumber: 'MR-AAAAAAAA', settings, stops, faces });
  const lid = buildLidPrint({
    boxFilamentId: 'elegoo-pla-black',
    boxFilamentName: 'Elegoo PLA Black',
    boxHex: '#161616',
    logoFilamentId: 'elegoo-pla-red',
    logoFilamentName: 'Elegoo PLA Red',
    logoHex: '#D4252B',
    text: 'Dom Fungus',
    textFilamentId: 'giantarm-silk-silver',
    textFilamentName: 'GiantArm Silk Silver',
    textHex: '#D5DCE3',
  });
  const withLid = await buildOrderZip({ orderNumber: 'MR-AAAAAAAA', settings, stops, faces, lid });
  const plainZip = await JSZip.loadAsync(plain);
  const lidZip = await JSZip.loadAsync(withLid);
  assert.equal(plainZip.file('front.stl'), null);
  assert.equal(plainZip.file('back.stl'), null);
  const plainLeft = await plainZip.file('left.stl')!.async('uint8array');
  const lidLeft = await lidZip.file('left.stl')!.async('uint8array');
  assert.deepEqual(lidLeft, plainLeft);
  assert.ok(lidZip.file('right.stl'));
  const manifestFaces = JSON.parse(await plainZip.file('filament-layers.json')!.async('string')) as { faces: Array<{ face: string }> };
  assert.deepEqual(manifestFaces.faces.map((face) => face.face), ['right', 'spine', 'left']);
  const body = await lidZip.file('box-body.stl')!.async('uint8array');
  const base = await lidZip.file('lid-base.stl')!.async('uint8array');
  const spark = await lidZip.file('lid-spark.stl')!.async('uint8array');
  const text = await lidZip.file('lid-text.stl')!.async('uint8array');
  assert.ok(decodeBinaryStl(body).length > 100);
  assert.ok(decodeBinaryStl(base).length > 100);
  assert.ok(decodeBinaryStl(spark).length > 10);
  assert.ok(decodeBinaryStl(text).length > 10);
  const note = await lidZip.file('lid-colours.txt')!.async('string');
  assert.match(note, /Elegoo PLA Black/);
  assert.match(note, /Dom Fungus/);
  assert.equal(note.includes(['Hue', 'Forge'].join('')), false);
  const manifest = JSON.parse(await lidZip.file('filament-layers.json')!.async('string')) as {
    print: { triangleCap: null };
    lid: { text: { value: string } };
  };
  assert.equal(manifest.print.triangleCap, null);
  assert.equal(manifest.lid.text.value, 'Dom Fungus');
});
