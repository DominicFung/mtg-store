import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultCropBox,
  extendSideForSubject,
  extendToAspect,
  faceAtX,
  outpaintMargins,
  subjectBounds,
  WRAP_ASPECT,
  type RgbaImage,
  type SubjectBounds,
} from '../../../packages/print-core/src/outpaint';

function disk(width: number, height: number, cx: number, cy: number, radius: number): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
      const value = inside ? 236 : 12;
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return { rgba, width, height };
}

function assertSpanOnFace(
  crop: { x: number; y: number; width: number; height: number },
  left: number,
  right: number,
  face: 'front' | 'back',
) {
  assert.equal(faceAtX(crop, (left + right) / 2), face);
  assert.equal(faceAtX(crop, left + 0.5), face);
  assert.equal(faceAtX(crop, right - 0.5), face);
  assert.notEqual(faceAtX(crop, (left + right) / 2), 'spine');
}

test('a subject on the left is extended only to the right and lands on the front', () => {
  const image = disk(80, 58, 18, 29, 8);
  const bounds = subjectBounds(image);
  assert.ok(bounds.center < 0.4, `expected a left centre, got ${bounds.center}`);
  assert.equal(extendSideForSubject(bounds.center), 'right');

  const margins = outpaintMargins(image.width, image.height, bounds);
  assert.equal(margins.left, 0);
  assert.equal(margins.up, 0);
  assert.equal(margins.down, 0);
  assert.ok(margins.right > 0);

  const extended = extendToAspect(image, WRAP_ASPECT);
  assert.ok(extended.width > image.width);
  assert.equal(extended.height, image.height);
  assert.ok(extended.width / extended.height + 0.02 >= WRAP_ASPECT);
  const crop = defaultCropBox(extended.width, extended.height, subjectBounds(extended));
  assertSpanOnFace(crop, 18 - 8, 18 + 8, 'front');
});

test('a subject on the right is extended only to the left and lands on the back', () => {
  const image = disk(80, 58, 62, 29, 8);
  const bounds = subjectBounds(image);
  assert.ok(bounds.center > 0.6, `expected a right centre, got ${bounds.center}`);
  assert.equal(extendSideForSubject(bounds.center), 'left');

  const margins = outpaintMargins(image.width, image.height, bounds);
  assert.equal(margins.right, 0);
  assert.equal(margins.up, 0);
  assert.equal(margins.down, 0);
  assert.ok(margins.left > 0);

  const extended = extendToAspect(image, WRAP_ASPECT);
  const added = extended.width - image.width;
  const crop = defaultCropBox(extended.width, extended.height, subjectBounds(extended));
  assertSpanOnFace(crop, added + 62 - 8, added + 62 + 8, 'back');
});

test('a centred subject is kept on the front face, not the spine', () => {
  const image = disk(80, 58, 40, 29, 10);
  const bounds = subjectBounds(image);
  assert.ok(Math.abs(bounds.center - 0.5) < 0.08, `expected a centred figure, got ${bounds.center}`);
  assert.equal(extendSideForSubject(0.5), 'right');

  const margins = outpaintMargins(image.width, image.height, { left: 0.4, right: 0.6, center: 0.5 });
  assert.equal(margins.left, 0);
  assert.ok(margins.right > 0);
  assert.equal(margins.up, 0);
  assert.equal(margins.down, 0);

  const extended = extendToAspect(image, WRAP_ASPECT, 'right');
  const crop = defaultCropBox(extended.width, extended.height, subjectBounds(extended));
  assertSpanOnFace(crop, 40 - 10, 40 + 10, 'front');
});

test('the default crop pulls a near-centre subject off the spine', () => {
  const wide = disk(400, 100, 180, 50, 12);
  const leftish = subjectBounds(wide);
  assert.ok(leftish.center < 0.5);
  const frontCrop = defaultCropBox(wide.width, wide.height, leftish);
  assert.equal(faceAtX(frontCrop, 180), 'front');

  const rightWide = disk(400, 100, 220, 50, 12);
  const rightish = subjectBounds(rightWide);
  assert.ok(rightish.center > 0.5);
  const backCrop = defaultCropBox(rightWide.width, rightWide.height, rightish);
  assert.equal(faceAtX(backCrop, 220), 'back');

  const centred: SubjectBounds = { left: 0.46, right: 0.54, center: 0.5 };
  const centredCrop = defaultCropBox(400, 100, centred);
  assert.equal(faceAtX(centredCrop, 200), 'front');
  assert.notEqual(faceAtX(centredCrop, 200), 'spine');
});

test('flip side extends the opposite edge and parks the subject on the other face', () => {
  const image = disk(80, 58, 18, 29, 8);
  const flipped = extendToAspect(image, WRAP_ASPECT, 'left');
  const added = flipped.width - image.width;
  assert.ok(added > 0);
  const margins = outpaintMargins(image.width, image.height, subjectBounds(image), 'left');
  assert.equal(margins.right, 0);
  assert.ok(margins.left > 0);
  const crop = defaultCropBox(flipped.width, flipped.height, {
    left: (added + 10) / flipped.width,
    right: (added + 26) / flipped.width,
    center: (added + 18) / flipped.width,
  });
  assertSpanOnFace(crop, added + 10, added + 26, 'back');
});
