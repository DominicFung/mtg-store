/** Three art faces: left 293, spine 255, right 293, height 326. The card window is the front. */
export const BOX_FACE_WIDTHS = [293, 255, 293] as const;
export const BOX_FACE_HEIGHT = 326;
export const BOX_WRAP_WIDTH = BOX_FACE_WIDTHS[0] + BOX_FACE_WIDTHS[1] + BOX_FACE_WIDTHS[2];
export const WRAP_ASPECT = BOX_WRAP_WIDTH / BOX_FACE_HEIGHT;

/** Stability Image Outpaint allows at most 2000 pixels on a side. */
export const STABILITY_MAX_MARGIN = 2000;

const LEFT_END = BOX_FACE_WIDTHS[0] / BOX_WRAP_WIDTH;
const RIGHT_START = (BOX_FACE_WIDTHS[0] + BOX_FACE_WIDTHS[1]) / BOX_WRAP_WIDTH;

export type ExtendSide = 'left' | 'right';
export type OuterFace = 'left' | 'right';
export type OutpaintMargins = { left: number; right: number; up: number; down: number };
export type RgbaImage = { rgba: Uint8Array; width: number; height: number };
export type SubjectBounds = { left: number; right: number; center: number };
export type CropRect = { x: number; y: number; width: number; height: number };

/**
 * Which way to grow the canvas. A subject on the left is extended to the right
 * so they stay on the left face; a subject on the right is extended to the left
 * so they stay on the right. A centred subject (Brigid) is kept on the left.
 */
export function extendSideForSubject(subjectX: number): ExtendSide {
  return subjectX > 0.5 ? 'left' : 'right';
}

export function outerFaceForSide(side: ExtendSide): OuterFace {
  return side === 'right' ? 'left' : 'right';
}

/** Move original-image fractions into the extended canvas. */
export function placeSubject(
  subject: SubjectBounds,
  sourceWidth: number,
  resultWidth: number,
  side: ExtendSide,
): SubjectBounds {
  const width = Math.max(1, resultWidth);
  const extra = Math.max(0, width - sourceWidth);
  const shift = side === 'left' ? extra : 0;
  const map = (fraction: number) => clamp01((clamp01(fraction) * sourceWidth + shift) / width);
  const left = map(Math.min(subject.left, subject.center));
  const right = map(Math.max(subject.right, subject.center));
  const center = map(subject.center);
  return { left: Math.min(left, center), right: Math.max(right, center), center };
}

/**
 * Centre of mass of skin-toned pixels when a figure is present, otherwise of
 * edge energy. `left` and `right` are the span that holds most of that mass.
 */
export function subjectBounds(image: RgbaImage): SubjectBounds {
  const { rgba, width, height } = image;
  if (width < 2 || height < 2) return { left: 0.42, right: 0.58, center: 0.5 };

  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));
  const cols = Math.ceil(width / step);
  const edge = new Float64Array(cols);
  const skin = new Float64Array(cols);
  let edgeTotal = 0;
  let skinTotal = 0;

  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722;
  };

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      // Horizontal contrast only. A one-sided edge extension is flat across x,
      // so it must not pull the subject into the new pixels.
      const dx = lum(Math.min(width - 1, x + step), y) - lum(Math.max(0, x - step), y);
      const energy = dx * dx;
      if (energy < 4) continue;
      const col = Math.min(cols - 1, Math.floor(x / step));
      edge[col] += energy;
      edgeTotal += energy;
      const i = (y * width + x) * 4;
      if (isSkin(rgba[i], rgba[i + 1], rgba[i + 2])) {
        skin[col] += energy;
        skinTotal += energy;
      }
    }
  }

  const useSkin = skinTotal > 0 && edgeTotal > 0 && skinTotal / edgeTotal >= 0.08;
  const weights = useSkin ? skin : edge;
  const total = useSkin ? skinTotal : edgeTotal;
  if (total <= 0) return { left: 0.42, right: 0.58, center: 0.5 };

  const span = massSpan(weights, 0.12, 0.88);
  let moment = 0;
  for (let i = 0; i < cols; i += 1) moment += weights[i] * (i + 0.5);
  const center = clamp01(moment / total / cols);
  const left = clamp01(span.start / cols);
  const right = clamp01((span.end + 1) / cols);
  return {
    left: Math.min(center, left),
    right: Math.max(center, right),
    center,
  };
}

/**
 * Pixels to add on one side so the three-face frame fits and the subject can
 * sit inside one outer face. The other side, and both vertical sides, stay 0.
 */
export function outpaintMargins(
  width: number,
  height: number,
  subject?: SubjectBounds,
  side?: ExtendSide,
): OutpaintMargins {
  const bounds = subject ?? { left: 0.5, right: 0.5, center: 0.5 };
  const chosen = side ?? extendSideForSubject(bounds.center);
  const extra = extensionPixels(width, height, bounds, chosen);
  return chosen === 'left'
    ? { left: extra, right: 0, up: 0, down: 0 }
    : { left: 0, right: extra, up: 0, down: 0 };
}

/**
 * Repeats the near edge on one side until the frame can hold the subject on
 * the left (extend right) or the right (extend left).
 */
export function extendToAspect(image: RgbaImage, aspect = WRAP_ASPECT, side?: ExtendSide): RgbaImage {
  const { rgba, width, height } = image;
  if (width < 1 || height < 1) throw new Error('Image is empty');
  const bounds = subjectBounds(image);
  const chosen = side ?? extendSideForSubject(bounds.center);
  const extra = extensionPixels(width, height, bounds, chosen, aspect);
  const nextWidth = width + extra;
  const nextHeight = height;
  if (extra === 0) return image;
  const offsetX = chosen === 'left' ? extra : 0;
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  const at = (x: number, y: number, channel: number) => {
    const sx = Math.min(width - 1, Math.max(0, x));
    const sy = Math.min(height - 1, Math.max(0, y));
    return rgba[(sy * width + sx) * 4 + channel];
  };
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const destination = (y * nextWidth + x) * 4;
      const sourceX = x - offsetX;
      for (let channel = 0; channel < 4; channel += 1) {
        out[destination + channel] = at(sourceX, y, channel);
      }
      if (sourceX < 0 || sourceX >= width) out[destination + 3] = 255;
    }
  }
  return { rgba: out, width: nextWidth, height: nextHeight };
}

/**
 * Largest three-face crop that keeps the subject inside the left face when
 * they sit on the left, or the right face when they sit on the right.
 */
export function defaultCropBox(imageWidth: number, imageHeight: number, subject: SubjectBounds): CropRect {
  if (imageWidth < 1 || imageHeight < 1) return { x: 0, y: 0, width: 0, height: 0 };
  const face: OuterFace = subject.center <= 0.5 ? 'left' : 'right';
  const faceStart = face === 'left' ? 0 : RIGHT_START;
  const faceEnd = face === 'left' ? LEFT_END : 1;
  const scale = Math.min(imageWidth / BOX_WRAP_WIDTH, imageHeight / BOX_FACE_HEIGHT);
  let width = BOX_WRAP_WIDTH * scale;
  let height = BOX_FACE_HEIGHT * scale;
  const minWidth = Math.min(width, 72);

  let x = 0;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const facePx = (faceEnd - faceStart) * width;
    const focus = focusSpan(subject, imageWidth, facePx);
    const lo = Math.max(0, focus.right - faceEnd * width);
    const hi = Math.min(Math.max(0, imageWidth - width), focus.left - faceStart * width);
    if (lo <= hi + 0.5) {
      const faceCenter = (faceStart + faceEnd) / 2;
      const ideal = (focus.left + focus.right) / 2 - faceCenter * width;
      x = clamp(ideal, lo, Math.max(lo, hi));
      break;
    }
    const next = width * 0.92;
    if (next < minWidth) {
      width = minWidth;
      height = width * BOX_FACE_HEIGHT / BOX_WRAP_WIDTH;
      const faceCenter = (faceStart + faceEnd) / 2;
      const centerPx = clamp01(subject.center) * imageWidth;
      x = clamp(centerPx - faceCenter * width, 0, Math.max(0, imageWidth - width));
      break;
    }
    width = next;
    height = width * BOX_FACE_HEIGHT / BOX_WRAP_WIDTH;
  }

  const y = clamp((imageHeight - height) / 2, 0, Math.max(0, imageHeight - height));
  return { x, y, width, height };
}

export function faceAtX(crop: CropRect, x: number): 'left' | 'spine' | 'right' {
  if (crop.width <= 0) return 'spine';
  const rel = (x - crop.x) / crop.width;
  if (rel < LEFT_END) return 'left';
  if (rel < RIGHT_START) return 'spine';
  return 'right';
}

function extensionPixels(
  width: number,
  height: number,
  subject: SubjectBounds,
  side: ExtendSide,
  aspect = WRAP_ASPECT,
): number {
  if (width < 1 || height < 1) return 0;
  const frameW = Math.max(1, Math.round(height * aspect));
  const facePx = LEFT_END * frameW;
  const focus = focusSpan(subject, width, facePx);
  const extra = side === 'left'
    ? extraOnLeft(width, frameW, focus.left)
    : extraOnRight(width, frameW, focus.right);
  return Math.max(0, Math.min(STABILITY_MAX_MARGIN, extra));
}

/** Padding on the right so [0, rightPx] can sit in the left face of the frame. */
function extraOnRight(width: number, frameW: number, rightPx: number): number {
  const frontW = LEFT_END * frameW;
  const lo = Math.max(0, rightPx - frontW);
  return Math.max(0, Math.ceil(lo + frameW - width));
}

/** Padding on the left so the subject can sit in the right face of the frame. */
function extraOnLeft(width: number, frameW: number, leftPx: number): number {
  const backStart = RIGHT_START * frameW;
  const needForFrame = Math.max(0, frameW - width);
  const needToClearSpine = Math.max(0, Math.ceil(backStart - leftPx));
  return Math.max(needForFrame, needToClearSpine);
}

function focusSpan(subject: SubjectBounds, imageWidth: number, facePx: number): { left: number; right: number } {
  const center = clamp01(subject.center) * imageWidth;
  let left = clamp01(Math.min(subject.left, subject.center)) * imageWidth;
  let right = clamp01(Math.max(subject.right, subject.center)) * imageWidth;
  const maxSpan = Math.max(4, facePx * 0.82);
  if (right - left > maxSpan) {
    left = center - maxSpan / 2;
    right = center + maxSpan / 2;
  }
  if (left < 0) {
    right -= left;
    left = 0;
  }
  if (right > imageWidth) {
    left -= right - imageWidth;
    right = imageWidth;
  }
  return {
    left: clamp(left, 0, imageWidth),
    right: clamp(Math.max(left, right), 0, imageWidth),
  };
}

function massSpan(weights: Float64Array, low: number, high: number): { start: number; end: number } {
  let total = 0;
  for (const value of weights) total += value;
  if (total <= 0) return { start: 0, end: Math.max(0, weights.length - 1) };
  let acc = 0;
  let start = 0;
  let end = weights.length - 1;
  let foundStart = false;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (!foundStart && acc >= total * low) {
      start = i;
      foundStart = true;
    }
    if (acc >= total * high) {
      end = i;
      break;
    }
  }
  return { start, end: Math.max(start, end) };
}

function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 90 && g > 40 && b > 20 && r > g && r > b && max - min > 15 && r - g > 12 && r - b > 12;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
