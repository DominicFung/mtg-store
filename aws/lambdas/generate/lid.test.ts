import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeBinaryStl, triangleBounds } from '../../../packages/print-core/src/printGeometry';
import {
  boundaryEdgeCount,
  buildLidTextMesh,
  EMBOSS_MM,
  LID_FONT_FILE,
  LID_SIZE,
  normalizeLidText,
  PLATE_TOP_MM,
  splitLid,
} from '../../../packages/print-core/src/lidGeometry';
import { canonicalFaceName } from '../../../packages/print-core/src/printGeometry';

const assets = join(__dirname, 'assets');
const lidBytes = new Uint8Array(readFileSync(join(assets, 'Lid.stl')));
const fontFile = readFileSync(join(assets, LID_FONT_FILE));
const font = fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength) as ArrayBuffer;

test('the lid splits into a flat base and the raised spark', () => {
  const source = decodeBinaryStl(lidBytes);
  assert.equal(source.length, 2182);
  const open = splitLid(source, false);
  assert.equal(open.base.length + open.spark.length, 2182);
  assert.equal(open.spark.length, 721);
  const sparkBounds = triangleBounds(open.spark);
  // Half turn about Z. The spark was centred in X and sat toward +Y; it stays centred and moves toward Y = 0.
  assert.ok(sparkBounds.min[0] > 22 && sparkBounds.max[0] < 55, `spark x ${sparkBounds.min[0]}..${sparkBounds.max[0]}`);
  assert.ok(sparkBounds.min[1] > 0 && sparkBounds.max[1] < 57, `spark y ${sparkBounds.min[1]}..${sparkBounds.max[1]}`);
  assert.ok(sparkBounds.max[2] > 8.3);
  assert.ok(triangleBounds(open.base).max[2] <= PLATE_TOP_MM + 0.02);

  const closed = splitLid(source, true);
  assert.equal(boundaryEdgeCount(closed.base), 0);
  assert.equal(boundaryEdgeCount(closed.spark), 0);
  assert.ok(closed.base.length > open.base.length);
  assert.ok(closed.spark.length > open.spark.length);
});

test('the name is a 1 mm emboss closer to the logo and still readable after the half turn', () => {
  const mesh = buildLidTextMesh(font, 'Dom Fungus');
  assert.ok(mesh.length > 20);
  const bounds = triangleBounds(mesh);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const turnedCenterY = LID_SIZE.depth - 23;
  assert.ok(Math.abs(centerX - LID_SIZE.width / 2) < 0.6, `center x ${centerX}`);
  assert.ok(Math.abs(centerY - turnedCenterY) < 0.6, `center y ${centerY}`);
  assert.ok(bounds.min[1] > 55, 'stays clear of the turned spark');
  assert.ok(bounds.max[1] < LID_SIZE.depth - 4, 'stays on the plate');
  assert.ok(bounds.max[0] - bounds.min[0] <= 58.1);
  assert.ok(Math.abs(bounds.min[2] - PLATE_TOP_MM) < 0.02);
  assert.ok(Math.abs((bounds.max[2] - bounds.min[2]) - EMBOSS_MM) < 0.02);
  assert.equal(boundaryEdgeCount(mesh), 0);

  const wide = buildLidTextMesh(font, 'ABCDEFGHIJKLMNOPQRST');
  const wideBounds = triangleBounds(wide);
  assert.ok(wideBounds.max[0] - wideBounds.min[0] <= 58.1);
  assert.ok(wideBounds.min[1] > 55 && wideBounds.max[1] < LID_SIZE.depth - 4);
  assert.equal(buildLidTextMesh(font, '   ').length, 0);
  assert.ok(buildLidTextMesh(font, "O'Brien & Co. 2").length > 20);
  assert.equal(buildLidTextMesh(font, '+').length, 0);

  const nCount = buildLidTextMesh(font, 'N').length;
  const oCount = buildLidTextMesh(font, 'O').length;
  const pair = buildLidTextMesh(font, 'NO');
  const centers = pair.map((triangle) => (triangle.verts[0][0] + triangle.verts[1][0] + triangle.verts[2][0]) / 3).sort((a, b) => a - b);
  let gapAt = centers[0];
  let gap = 0;
  for (let index = 1; index < centers.length; index += 1) {
    const span = centers[index] - centers[index - 1];
    if (span > gap) {
      gap = span;
      gapAt = (centers[index] + centers[index - 1]) / 2;
    }
  }
  const lowXCount = pair.filter((triangle) => (triangle.verts[0][0] + triangle.verts[1][0] + triangle.verts[2][0]) / 3 < gapAt).length;
  // The half turn swaps X. From the end the lid slides out of, N is still the left letter.
  assert.ok(Math.abs(lowXCount - oCount) < Math.abs(lowXCount - nCount), `O should be the low-X letter after the turn, ${lowXCount} vs N ${nCount} O ${oCount}`);
});

test('lid names are optional and capped at 20 characters', () => {
  assert.equal(normalizeLidText('  Dom   Fungus '), 'Dom Fungus');
  assert.equal(normalizeLidText(''), '');
  assert.equal(normalizeLidText(null), '');
  assert.throws(() => normalizeLidText('this name is too long'), /20/);
  assert.throws(() => normalizeLidText('no_underscores'), /letters/);
  assert.throws(() => normalizeLidText('A+B'), /letters/);
});

test('older face keys still name the left and right plates', () => {
  assert.equal(canonicalFaceName('front'), 'left');
  assert.equal(canonicalFaceName('back'), 'right');
  assert.equal(canonicalFaceName('left'), 'left');
  assert.equal(canonicalFaceName('spine'), 'spine');
  assert.equal(canonicalFaceName('nope'), null);
});
