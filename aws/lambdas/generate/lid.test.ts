import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeBinaryStl, triangleBounds } from '../../../packages/print-core/src/printGeometry';
import {
  boundaryEdgeCount,
  buildLidTextMesh,
  EMBOSS_MM,
  LID_SIZE,
  normalizeLidText,
  PLATE_TOP_MM,
  splitLid,
} from '../../../packages/print-core/src/lidGeometry';

const assets = join(__dirname, 'assets');
const lidBytes = new Uint8Array(readFileSync(join(assets, 'Lid.stl')));
const fontFile = readFileSync(join(assets, 'Oswald-Bold.ttf'));
const font = fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength) as ArrayBuffer;

test('the lid splits into a flat base and the raised spark', () => {
  const source = decodeBinaryStl(lidBytes);
  assert.equal(source.length, 2182);
  const open = splitLid(source, false);
  assert.equal(open.base.length + open.spark.length, 2182);
  assert.equal(open.spark.length, 721);
  const sparkBounds = triangleBounds(open.spark);
  assert.ok(sparkBounds.min[0] > 23 && sparkBounds.max[0] < 54);
  assert.ok(sparkBounds.min[1] > 32 && sparkBounds.max[1] < 87);
  assert.ok(sparkBounds.max[2] > 8.3);
  assert.ok(triangleBounds(open.base).max[2] <= PLATE_TOP_MM + 0.02);

  const closed = splitLid(source, true);
  assert.equal(boundaryEdgeCount(closed.base), 0);
  assert.equal(boundaryEdgeCount(closed.spark), 0);
  assert.ok(closed.base.length > open.base.length);
  assert.ok(closed.spark.length > open.spark.length);
});

test('the name is a 1 mm emboss centred on the flat band and readable from the notch', () => {
  const mesh = buildLidTextMesh(font, 'Dom Fungus');
  assert.ok(mesh.length > 20);
  const bounds = triangleBounds(mesh);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  assert.ok(Math.abs(centerX - LID_SIZE.width / 2) < 0.6, `center x ${centerX}`);
  assert.ok(Math.abs(centerY - 17.5) < 0.6, `center y ${centerY}`);
  assert.ok(bounds.min[1] > 6, 'stays clear of the notch');
  assert.ok(bounds.max[1] < 31, 'stays clear of the spark');
  assert.ok(bounds.max[0] - bounds.min[0] <= 58.1);
  assert.ok(Math.abs(bounds.min[2] - PLATE_TOP_MM) < 0.02);
  assert.ok(Math.abs((bounds.max[2] - bounds.min[2]) - EMBOSS_MM) < 0.02);
  assert.equal(boundaryEdgeCount(mesh), 0);

  const wide = buildLidTextMesh(font, 'ABCDEFGHIJKLMNOPQRST');
  const wideBounds = triangleBounds(wide);
  assert.ok(wideBounds.max[0] - wideBounds.min[0] <= 58.1);
  assert.ok(wideBounds.min[1] > 6 && wideBounds.max[1] < 31);
  assert.equal(buildLidTextMesh(font, '   ').length, 0);
});

test('lid names are optional and capped at 20 characters', () => {
  assert.equal(normalizeLidText('  Dom   Fungus '), 'Dom Fungus');
  assert.equal(normalizeLidText(''), '');
  assert.equal(normalizeLidText(null), '');
  assert.throws(() => normalizeLidText('this name is too long'), /20/);
  assert.throws(() => normalizeLidText('no_underscores'), /punctuation/);
});
