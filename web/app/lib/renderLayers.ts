import { Filament } from './filamentCatalogue';
import { colorForLuminance, equalBoundaries, hexToRgb, luminanceBounds, relativeLuminance, stretchLuminance } from './hueforge';

type LumaBuffer = {
  width: number;
  height: number;
  luma: Float32Array;
  alpha: Uint8ClampedArray;
};

const cache = new Map<string, LumaBuffer>();
const CACHE_LIMIT = 8;

function remember(key: string, value: LumaBuffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function prepare(src: string, maxEdge: number): Promise<LumaBuffer | null> {
  const cached = cache.get(src);
  if (cached) {
    remember(src, cached);
    return cached;
  }

  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > 0 ? Math.min(1, maxEdge / longest) : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const luma = new Float32Array(width * height);
  const alpha = new Uint8ClampedArray(width * height);

  for (let pixel = 0, offset = 0; pixel < luma.length; pixel += 1, offset += 4) {
    alpha[pixel] = pixels.data[offset + 3];
    luma[pixel] = relativeLuminance(pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]);
  }

  const [min, max] = luminanceBounds(luma, alpha);
  for (let pixel = 0; pixel < luma.length; pixel += 1) {
    luma[pixel] = stretchLuminance(luma[pixel], min, max);
  }

  const buffer = { width, height, luma, alpha };
  remember(src, buffer);
  return buffer;
}

function paint(
  buffer: LumaBuffer,
  colors: [number, number, number][],
  transmissionDistances: number[],
  boundaries: number[],
): string {
  const canvas = document.createElement('canvas');
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(buffer.width, buffer.height);
  const { data } = image;
  for (let pixel = 0, offset = 0; pixel < buffer.luma.length; pixel += 1, offset += 4) {
    const alpha = buffer.alpha[pixel];
    if (alpha < 16) {
      data[offset + 3] = 0;
      continue;
    }
    const [red, green, blue] = colorForLuminance(buffer.luma[pixel], colors, transmissionDistances, boundaries);
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = alpha;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function renderLayeredCrops(
  crops: readonly [string, string, string],
  layers: readonly Pick<Filament, 'hex' | 'td'>[],
  boundaries: readonly number[],
  maxEdge = 640,
): Promise<[string, string, string]> {
  if (layers.length === 0) return ['', '', ''];
  const colors = layers.map((layer) => hexToRgb(layer.hex));
  const transmissionDistances = layers.map((layer) => layer.td);
  const safeBoundaries = boundaries.length === layers.length - 1
    ? [...boundaries]
    : equalBoundaries(layers.length);

  const rendered = await Promise.all(crops.map(async (src) => {
    if (!src) return '';
    const buffer = await prepare(src, maxEdge);
    if (!buffer) return '';
    return paint(buffer, colors, transmissionDistances, safeBoundaries);
  }));

  return [rendered[0] ?? '', rendered[1] ?? '', rendered[2] ?? ''];
}
