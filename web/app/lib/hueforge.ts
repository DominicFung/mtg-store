export type Rgb = [number, number, number];

/**
 * HueForge's published definition: TD is the thickness that blocks about 95%
 * of the light, so transmission at one TD is 0.05.
 *
 * The colour core in brigid-case-2-back is much more opaque than that curve.
 * Raising the exponent by this density reproduces the white cap and the
 * ice-blue slider on that core (density 1 stays a grey wash). It is a
 * calibration against that screenshot, not a second measurement of TD.
 */
export const TRANSMISSION_DENSITY = 10;

/** HueForge "Smoothing 4": blur radius in detail-size samples. */
export const DEFAULT_SMOOTHING = 4;

/** Combo slider at 1 is standard luminance. 0 is max-channel. */
export const DEFAULT_COMBO_WEIGHT = 1;

const UM = 1000;

export type LayerSettings = {
  layerHeight: number;
  baseLayerHeight: number;
  minDepth: number;
  maxDepth: number;
};

export type DescribeFilament = {
  /** Polymer. Missing values are PLA. */
  type?: string | null;
  brand?: string | null;
  /** Short colour name. Swap lines use this. */
  name: string;
  td: number;
};

export type CoreStop = {
  filament: DescribeFilament;
  rgb: Rgb;
  /** Inclusive 1-based layer where this filament ends. */
  endLayer: number;
};

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function mmToUm(mm: number): number {
  return Math.round(mm * UM);
}

export function hexToRgb(hex: string): Rgb {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((channel) => channel + channel).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [128, 128, 128];
  const parsed = Number.parseInt(full, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

/**
 * BT.601 luminance of sRGB bytes, 0..1. This is the lithophane "standard"
 * brightness: it matches both HueForge STLs; Rec. 709 does not.
 */
export function standardLuminance(red: number, green: number, blue: number): number {
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

export function maxChannelLuminance(red: number, green: number, blue: number): number {
  return Math.max(red, green, blue) / 255;
}

/**
 * Combo luminance. Weight 1 is standard (brighter = taller). Weight 0 is the
 * max RGB channel. HueForge's default combo slider is standard.
 */
export function comboLuminance(red: number, green: number, blue: number, weight = DEFAULT_COMBO_WEIGHT): number {
  const mix = clamp01(weight);
  return standardLuminance(red, green, blue) * mix
    + maxChannelLuminance(red, green, blue) * (1 - mix);
}

/** Z at the top of a 1-based layer, in microns. Layer 1 ends at the base height. */
export function layerTopUm(layer: number, settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): number {
  if (layer <= 0) return 0;
  const base = mmToUm(settings.baseLayerHeight);
  const step = mmToUm(settings.layerHeight);
  return base + (layer - 1) * step;
}

export function layerTopMm(layer: number, settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): number {
  return layerTopUm(layer, settings) / UM;
}

/**
 * Colour-core layer count. The layer whose top meets Max Depth, plus one so
 * Actual Depth can sit a layer above Max Depth (2.01 → layer 49, core → 50,
 * top 2.05 when the base is 0.09 and the step is 0.04).
 */
export function colorCoreLayerCount(settings: LayerSettings): number {
  const step = mmToUm(settings.layerHeight);
  if (step <= 0) return 1;
  const steps = Math.round((mmToUm(settings.maxDepth) - mmToUm(settings.baseLayerHeight)) / step);
  return Math.max(1, steps + 2);
}

/** 1-based layer whose top is nearest to this depth. */
export function layerForDepth(depthMm: number, settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): number {
  const step = mmToUm(settings.layerHeight);
  if (step <= 0) return 1;
  return Math.max(1, Math.round((mmToUm(depthMm) - mmToUm(settings.baseLayerHeight)) / step) + 1);
}

export function minBlendLayer(settings: LayerSettings): number {
  return Math.min(layerForDepth(settings.minDepth, settings), colorCoreLayerCount(settings));
}

/**
 * Standard brightness compensation: stretch the picture's own black and white
 * onto the blend range. A power curve and a percentile clip both increased
 * the error against the real STLs.
 */
export function stretchToUnit(luma: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < luma.length; index += 1) {
    const value = luma[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  const out = new Float32Array(luma.length);
  if (!(span > 1e-8)) {
    out.fill(0);
    return out;
  }
  for (let index = 0; index < luma.length; index += 1) {
    const shaped = (luma[index] - min) / span;
    out[index] = shaped < 0 ? 0 : shaped > 1 ? 1 : shaped;
  }
  return out;
}

/** Standard mode: 0 maps to Min Depth, 1 maps to the top of the colour core. */
export function layerForLuminance(luminance: number, minLayer: number, maxLayer: number): number {
  if (maxLayer <= minLayer) return minLayer;
  const t = luminance < 0 ? 0 : luminance > 1 ? 1 : luminance;
  return minLayer + Math.round(t * (maxLayer - minLayer));
}

/** Continuous mesh height. Not snapped to a layer. */
export function heightForUnitLuminance(unit: number, minDepth: number, actualDepth: number): number {
  const span = actualDepth - minDepth;
  const t = unit < 0 ? 0 : unit > 1 ? 1 : unit;
  return minDepth + t * span;
}

/** One [1, 2, 1] / 4 pass. A 4-cell box was a worse match to both STLs. */
export function binomialSmooth(source: Float32Array, width: number, height: number): Float32Array {
  if (width < 1 || height < 1) return source;
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const at = (buffer: Float32Array, x: number, y: number) => {
    const xx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const yy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return buffer[yy * width + xx];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = (at(source, x - 1, y) + 2 * at(source, x, y) + at(source, x + 1, y)) / 4;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      output[y * width + x] = (at(horizontal, x, y - 1) + 2 * at(horizontal, x, y) + at(horizontal, x, y + 1)) / 4;
    }
  }
  return output;
}

export function transmission(thicknessMm: number, tdMm: number, density = TRANSMISSION_DENSITY): number {
  if (thicknessMm <= 0) return 1;
  if (tdMm <= 0) return 0;
  return 0.05 ** ((thicknessMm / tdMm) * density);
}

export function blendOver(under: Rgb, over: Rgb, thicknessMm: number, tdMm: number): Rgb {
  const pass = transmission(thicknessMm, tdMm);
  const cover = 1 - pass;
  return [
    under[0] * pass + over[0] * cover,
    under[1] * pass + over[1] * cover,
    under[2] * pass + over[2] * cover,
  ];
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Predicted colour of a column that ends at `layer`.
 * The bottom filament is an opaque backing. Each filament above it covers
 * the stack across the layers of that stop which are actually present.
 */
export function colorAtLayer(layer: number, stops: readonly CoreStop[], settings: LayerSettings): Rgb {
  if (stops.length === 0) return [128, 128, 128];
  const target = Math.max(1, layer);
  let color: Rgb = [stops[0].rgb[0], stops[0].rgb[1], stops[0].rgb[2]];
  let previousEnd = 0;
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const from = previousEnd + 1;
    const to = Math.min(stop.endLayer, target);
    if (index > 0 && to >= from) {
      const thicknessMm = (layerTopUm(to, settings) - layerTopUm(from - 1, settings)) / UM;
      color = blendOver(color, stop.rgb, thicknessMm, stop.filament.td);
    }
    if (target <= stop.endLayer) break;
    previousEnd = stop.endLayer;
  }
  return [clampByte(color[0]), clampByte(color[1]), clampByte(color[2])];
}

export function layerPalette(stops: readonly CoreStop[], settings: LayerSettings, layerCount: number): Rgb[] {
  const colors: Rgb[] = [];
  for (let layer = 1; layer <= layerCount; layer += 1) {
    colors.push(colorAtLayer(layer, stops, settings));
  }
  return colors;
}

export function formatHueNumber(value: number, decimals = 2): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toFixed(decimals).replace(/\.?0+$/, '');
}

export function formatSwapDepth(layer: number, settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): string {
  return (layerTopUm(layer, settings) / UM).toFixed(2);
}

export function filamentType(filament: DescribeFilament): string {
  const raw = (filament.type ?? '').trim();
  return (raw || 'PLA').toUpperCase();
}

const NAME_PREFIX = /^(PLA|PETG|ABS|ASA|TPU|SILK|MATTE|PRO|BASIC)\s+/i;

/** Swap lines use the short colour. Catalogue rows store a longer product name. */
export function shortFilamentName(filament: DescribeFilament): string {
  let name = filament.name.trim();
  const brand = (filament.brand ?? '').trim();
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
    name = name.slice(brand.length).trim();
  }
  for (let pass = 0; pass < 4; pass += 1) {
    const next = name.replace(NAME_PREFIX, '');
    if (next === name) break;
    name = next;
  }
  return name || filament.name.trim();
}

export function filamentUsedLine(filament: DescribeFilament): string {
  const parts = [filamentType(filament), (filament.brand ?? '').trim(), shortFilamentName(filament)]
    .filter((part) => part.length > 0);
  return `${parts.join(' ')} Transmission Distance: ${formatHueNumber(filament.td, 4)}`;
}

function uniqueFilamentCount(stops: readonly CoreStop[]): number {
  const seen = new Set(stops.map((stop) => {
    const filament = stop.filament;
    return [
      filamentType(filament),
      (filament.brand ?? '').trim().toLowerCase(),
      shortFilamentName(filament).toLowerCase(),
    ].join('|');
  }));
  return seen.size;
}

function mixedFilamentTypes(stops: readonly CoreStop[]): boolean {
  const types = new Set(stops.map((stop) => filamentType(stop.filament)));
  return types.size > 1;
}

/**
 * HueForge describe text. Project name is the only caller-chosen token.
 * Max Depth and Actual Depth are whole millimetres. Swap depths keep two
 * decimals. Transmission distances drop trailing zeros.
 */
export function formatDetails(input: {
  projectName: string;
  widthMm: number;
  heightMm: number;
  settings: LayerSettings;
  stops: readonly CoreStop[];
}): string {
  const { settings, stops } = input;
  if (stops.length === 0) throw new Error('Choose at least one filament');
  const actualDepth = layerTopMm(stops[stops.length - 1].endLayer, settings);
  const lines = [
    `Project: ${input.projectName}`,
    `Print at 100% infill with a layer height of ${formatHueNumber(settings.layerHeight)}mm with a base layer of ${formatHueNumber(settings.baseLayerHeight)}mm`,
    '',
    ` The Model is ${formatHueNumber(input.widthMm)}x${formatHueNumber(input.heightMm)}mm in size`,
    ` You may print at higher layer heights below the Min Depth of ${formatHueNumber(settings.minDepth)}mm`,
    ` The Max Depth is ${Math.round(settings.maxDepth)}mm and the Actual Depth is ${Math.round(actualDepth)}mm`,
    '',
    'Filaments Used:',
    ...stops.map((stop) => `\t${filamentUsedLine(stop.filament)}`),
    `This print uses ${uniqueFilamentCount(stops)} unique filaments`,
    '',
  ];
  if (mixedFilamentTypes(stops)) {
    lines.push('!!!!  It appears you have mixed filament types.  Be certain this is what you want.  !!!!!');
    lines.push('');
  }
  lines.push('Swap Instructions:');
  lines.push(`\tStart with ${shortFilamentName(stops[0].filament)}`);
  for (let index = 0; index < stops.length - 1; index += 1) {
    const next = stops[index + 1];
    const rest = index === stops.length - 2 ? ' for the rest.' : '';
    lines.push(
      `\tAt layer #${stops[index].endLayer} (${formatSwapDepth(stops[index].endLayer, settings)}mm) swap to ${shortFilamentName(next.filament)}${rest}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export function evenStops(count: number, layerCount: number): number[] {
  const total = Math.max(1, layerCount);
  const n = Math.max(1, Math.min(count, total));
  const stops: number[] = [];
  let previous = 0;
  for (let index = 1; index <= n; index += 1) {
    const target = index === n ? total : Math.round((index * total) / n);
    const roomForRest = n - index;
    const end = Math.min(total - roomForRest, Math.max(previous + 1, target));
    stops.push(end);
    previous = end;
  }
  stops[stops.length - 1] = total;
  return stops;
}

export function insertStop(stops: readonly number[]): { stops: number[]; index: number } {
  if (stops.length === 0) return { stops: [1], index: 0 };
  let previous = 0;
  let gapIndex = 0;
  let gapSize = 0;
  for (let index = 0; index < stops.length; index += 1) {
    const size = stops[index] - previous;
    if (size >= gapSize) {
      gapSize = size;
      gapIndex = index;
    }
    previous = stops[index];
  }
  if (gapSize < 2) return { stops: [...stops], index: -1 };
  const before = gapIndex === 0 ? 0 : stops[gapIndex - 1];
  const endLayer = Math.min(stops[gapIndex] - 1, Math.max(before + 1, before + Math.floor(gapSize / 2)));
  const next = stops.slice();
  next.splice(gapIndex, 0, endLayer);
  return { stops: next, index: gapIndex };
}

export function removeStop(stops: readonly number[], index: number): number[] {
  if (stops.length <= 1 || index < 0 || index >= stops.length) return [...stops];
  const top = stops[stops.length - 1];
  const next = stops.filter((_, stopIndex) => stopIndex !== index);
  next[next.length - 1] = top;
  for (let cursor = next.length - 2; cursor >= 0; cursor -= 1) {
    if (next[cursor] >= next[cursor + 1]) next[cursor] = next[cursor + 1] - 1;
  }
  return next;
}

export function moveStop(stops: readonly number[], index: number, endLayer: number, layerCount: number): number[] {
  if (index < 0 || index >= stops.length) return [...stops];
  const next = stops.slice();
  const min = index === 0 ? 1 : next[index - 1] + 1;
  const max = index === next.length - 1 ? layerCount : next[index + 1] - 1;
  next[index] = Math.min(max, Math.max(min, Math.round(endLayer)));
  return next;
}

export function clampStops(stops: readonly number[], layerCount: number): number[] {
  const total = Math.max(1, layerCount);
  if (stops.length === 0) return [total];
  const next = stops.map((stop) => Math.min(total, Math.max(1, Math.round(stop))));
  for (let index = 1; index < next.length; index += 1) {
    if (next[index] <= next[index - 1]) next[index] = Math.min(total, next[index - 1] + 1);
  }
  for (let index = next.length - 2; index >= 0; index -= 1) {
    if (next[index] >= next[index + 1]) next[index] = next[index + 1] - 1;
  }
  if (next.some((stop) => stop < 1)) return evenStops(stops.length, total);
  return next;
}

function sampleClamp(source: Float32Array, width: number, height: number, x: number, y: number): number {
  const xx = Math.min(width - 1, Math.max(0, x));
  const yy = Math.min(height - 1, Math.max(0, y));
  return source[yy * width + xx];
}

/** Box blur. Radius is in pixels of this buffer. */
export function smoothLuminance(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.round(radius);
  if (r <= 0 || width < 1 || height < 1) return source;
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const window = r * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let k = -r; k <= r; k += 1) sum += sampleClamp(source, width, height, k, y);
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / window;
      sum -= sampleClamp(source, width, height, x - r, y);
      sum += sampleClamp(source, width, height, x + r + 1, y);
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let k = -r; k <= r; k += 1) sum += sampleClamp(horizontal, width, height, x, k);
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / window;
      sum -= sampleClamp(horizontal, width, height, x, y - r);
      sum += sampleClamp(horizontal, width, height, x, y + r + 1);
    }
  }
  return output;
}

export function bilinear(source: Float32Array, width: number, height: number, u: number, v: number): number {
  if (width <= 1 && height <= 1) return source[0] ?? 0;
  const x = clamp01(u) * (width - 1);
  const y = clamp01(v) * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (xx: number, yy: number) => source[yy * width + xx];
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

export function luminanceFromRgba(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  comboWeight = DEFAULT_COMBO_WEIGHT,
): Float32Array {
  const luma = new Float32Array(width * height);
  for (let pixel = 0, offset = 0; pixel < luma.length; pixel += 1, offset += 4) {
    luma[pixel] = comboLuminance(rgba[offset], rgba[offset + 1], rgba[offset + 2], comboWeight);
  }
  return luma;
}

/**
 * Blur radius in pixels so `smoothing` detail-samples stay the same physical
 * size when the buffer is coarser or finer than the mesh detail size.
 */
export function smoothingRadiusPx(
  pixelWidth: number,
  modelWidthMm: number,
  detailSizeMm: number,
  smoothing = DEFAULT_SMOOTHING,
): number {
  if (smoothing <= 0 || modelWidthMm <= 0 || pixelWidth <= 0) return 0;
  return (smoothing * pixelWidth * detailSizeMm) / modelWidthMm;
}

export type RenderInput = {
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  modelWidthMm: number;
  modelHeightMm: number;
  stops: readonly CoreStop[];
  settings: LayerSettings & { detailSize?: number };
  smoothing?: number;
  /** Bake a simple front light so the relief reads the way HueForge's lit preview does. */
  shade?: boolean;
};

export function renderBlendedRgba(input: RenderInput): Uint8ClampedArray {
  const { width, height, settings, stops } = input;
  const smoothed = (input.smoothing ?? DEFAULT_SMOOTHING) > 0
    ? binomialSmooth(luminanceFromRgba(input.rgba, width, height), width, height)
    : luminanceFromRgba(input.rgba, width, height);
  const luma = stretchToUnit(smoothed);
  const layerCount = Math.max(1, stops.length ? stops[stops.length - 1].endLayer : colorCoreLayerCount(settings));
  const minLayer = Math.min(minBlendLayer(settings), layerCount);
  const actualDepth = layerTopMm(layerCount, settings);
  const palette = layerPalette(stops, settings, layerCount);
  const output = new Uint8ClampedArray(width * height * 4);
  const pixelMmX = input.modelWidthMm / Math.max(1, width);
  const pixelMmY = input.modelHeightMm / Math.max(1, height);
  const heightAt = (x: number, y: number) => {
    const sample = bilinear(luma, width, height, x / Math.max(1, width - 1), y / Math.max(1, height - 1));
    return heightForUnitLuminance(sample, settings.minDepth, actualDepth);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const z = heightForUnitLuminance(luma[index], settings.minDepth, actualDepth);
      const layer = Math.min(layerCount, Math.max(minLayer, layerForDepth(z, settings)));
      let [red, green, blue] = palette[layer - 1] ?? palette[0];
      if (input.shade) {
        const zLeft = heightAt(x - 1, y);
        const zRight = heightAt(x + 1, y);
        const zUp = heightAt(x, y - 1);
        const zDown = heightAt(x, y + 1);
        const dx = (zRight - zLeft) / (2 * pixelMmX);
        const dy = (zDown - zUp) / (2 * pixelMmY);
        const len = Math.hypot(dx, dy, 1);
        const nz = 1 / len;
        const nx = -dx / len;
        const ny = -dy / len;
        const light = nx * 0.15 + ny * -0.35 + nz * 0.85;
        const gain = 0.62 + 0.5 * Math.max(0, Math.min(1, light));
        red = clampByte(red * gain);
        green = clampByte(green * gain);
        blue = clampByte(blue * gain);
      }
      output[offset] = red;
      output[offset + 1] = green;
      output[offset + 2] = blue;
      output[offset + 3] = input.rgba[offset + 3];
    }
  }
  return output;
}
