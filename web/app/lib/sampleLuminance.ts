import { luminanceBounds, relativeLuminance, stretchLuminance } from './hueforge';

export function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image.decode().then(() => image);
}

/** Downscale a crop to a vertex grid and stretch luminance the same way as the preview. */
export async function sampleStretchedLuminance(
  src: string,
  cols: number,
  rows: number,
): Promise<{ luma: Float32Array; width: number; height: number }> {
  if (cols < 1 || rows < 1) throw new Error('Sample grid must be at least 1x1');
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not read the crop');
  context.drawImage(image, 0, 0, cols, rows);
  const pixels = context.getImageData(0, 0, cols, rows);
  const count = cols * rows;
  const luma = new Float32Array(count);
  const alpha = new Uint8ClampedArray(count);
  for (let pixel = 0, offset = 0; pixel < count; pixel += 1, offset += 4) {
    alpha[pixel] = pixels.data[offset + 3];
    luma[pixel] = relativeLuminance(pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]);
  }
  const [min, max] = luminanceBounds(luma, alpha);
  for (let pixel = 0; pixel < count; pixel += 1) {
    luma[pixel] = stretchLuminance(luma[pixel], min, max);
  }
  return { luma, width: image.naturalWidth, height: image.naturalHeight };
}
