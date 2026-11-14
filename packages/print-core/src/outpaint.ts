/** Three box faces share this frame: front 293, spine 255, back 293, height 326. */
export const WRAP_ASPECT = (293 + 255 + 293) / 326;

export type OutpaintMargins = { left: number; right: number; up: number; down: number };

/**
 * Pixels to add so the art reaches the three-face frame.
 * Stability Image Outpaint allows at most 2000 pixels on each side.
 */
export function outpaintMargins(width: number, height: number): OutpaintMargins {
  if (width < 1 || height < 1) return { left: 0, right: 0, up: 0, down: 0 };
  const aspect = width / height;
  if (aspect < WRAP_ASPECT - 0.01) {
    const [left, right] = splitMargin(height * WRAP_ASPECT - width);
    return { left, right, up: 0, down: 0 };
  }
  if (aspect > WRAP_ASPECT + 0.01) {
    const [up, down] = splitMargin(width / WRAP_ASPECT - height);
    return { left: 0, right: 0, up, down };
  }
  return { left: 0, right: 0, up: 0, down: 0 };
}

function splitMargin(extra: number): [number, number] {
  const total = Math.max(0, Math.round(extra));
  const first = Math.min(2000, Math.floor(total / 2));
  const second = Math.min(2000, total - first);
  return [first, second];
}

export type RgbaImage = { rgba: Uint8Array; width: number; height: number };

/**
 * Deterministic stand-in for the Bedrock outpaint. The artwork stays centred
 * and the new columns repeat the edge, which is what the crop frame needs
 * when the model is not enabled yet.
 */
export function extendToAspect(image: RgbaImage, aspect = WRAP_ASPECT): RgbaImage {
  const { rgba, width, height } = image;
  if (width < 1 || height < 1) throw new Error('Image is empty');
  const current = width / height;
  let nextWidth = width;
  let nextHeight = height;
  if (current < aspect) nextWidth = Math.max(width, Math.round(height * aspect));
  else if (current > aspect) nextHeight = Math.max(height, Math.round(width / aspect));
  if (nextWidth === width && nextHeight === height) return image;
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  const offsetX = Math.floor((nextWidth - width) / 2);
  const offsetY = Math.floor((nextHeight - height) / 2);
  const at = (x: number, y: number, channel: number) => {
    const sx = Math.min(width - 1, Math.max(0, x));
    const sy = Math.min(height - 1, Math.max(0, y));
    return rgba[(sy * width + sx) * 4 + channel];
  };
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const destination = (y * nextWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        out[destination + channel] = at(x - offsetX, y - offsetY, channel);
      }
      if (x < offsetX || x >= offsetX + width || y < offsetY || y >= offsetY + height) {
        out[destination + 3] = 255;
      }
    }
  }
  return { rgba: out, width: nextWidth, height: nextHeight };
}
