import { colorCoreLayerCount, evenStops, hexToRgb, standardLuminance, type LayerSettings, type Rgb } from './colourCore';

export type PaletteFilament = {
  id: string;
  name: string;
  hex: string;
  td: number;
  type?: string | null;
  brand?: string | null;
  inStock?: boolean;
};

export type ColorChoice = {
  ids: string[];
  endLayers: number[];
};

const SAMPLE = 48;
const HUE_BINS = 24;

type Lab = [number, number, number];

type Sample = {
  lab: Lab;
  /** Pull toward saturated pixels so a small accent can hold a centre. */
  w: number;
  chroma: number;
};

type Peak = {
  lab: Lab;
  weight: number;
};

/**
 * Pick distinct in-stock filaments for a colour-core stack.
 *
 * Clusters are weighted in OKLab so a small saturated accent (yellow, orange)
 * keeps its own centre instead of being averaged into the surrounding blue.
 * Each centre takes the nearest filament that has not already been used.
 * The stack is then ordered dark-base first, by luminance with a small
 * transmission-distance nudge so a more translucent spool of similar
 * brightness sits higher.
 */
export function chooseColorCore(input: {
  rgba: Uint8Array;
  width: number;
  height: number;
  filaments: readonly PaletteFilament[];
  settings: LayerSettings;
  count?: number;
}): ColorChoice {
  const stock = input.filaments.filter((filament) => filament.inStock !== false && filament.td >= 0);
  if (stock.length === 0) throw new Error('No filaments are in stock');
  const layerCount = Math.max(1, colorCoreLayerCount(input.settings));
  const count = Math.max(1, Math.min(input.count ?? 6, stock.length, layerCount, 8));
  const samples = sampleArt(input.rgba, input.width, input.height);
  if (samples.length === 0) {
    const darkest = stock.slice().sort((a, b) => filamentLuminance(a) - filamentLuminance(b))[0];
    return { ids: [darkest.id], endLayers: [layerCount] };
  }
  const centers = buildCenters(samples, count);
  const chosen = matchDistinct(centers, stock);
  const ordered = orderForPrint(chosen);
  return { ids: ordered.map((filament) => filament.id), endLayers: evenStops(ordered.length, layerCount) };
}

function filamentLuminance(filament: PaletteFilament): number {
  const [red, green, blue] = hexToRgb(filament.hex);
  return standardLuminance(red, green, blue);
}

/** Darker first. A higher TD floats a filament up when luminance is close. */
function printScore(filament: PaletteFilament): number {
  return filamentLuminance(filament) + Math.min(12, Math.max(0, filament.td)) * 0.012;
}

function orderForPrint(filaments: readonly PaletteFilament[]): PaletteFilament[] {
  return filaments.slice().sort((a, b) => printScore(a) - printScore(b) || a.id.localeCompare(b.id));
}

function srgbChannelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(rgb: Rgb): Lab {
  const red = srgbChannelToLinear(rgb[0]);
  const green = srgbChannelToLinear(rgb[1]);
  const blue = srgbChannelToLinear(rgb[2]);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot,
  ];
}

function labDistance(left: Lab, right: Lab): number {
  const dL = left[0] - right[0];
  const dA = left[1] - right[1];
  const dB = left[2] - right[2];
  return Math.hypot(dL, dA, dB);
}

function weightedMean(samples: readonly Sample[]): Lab {
  let weight = 0;
  let l = 0;
  let a = 0;
  let b = 0;
  for (const sample of samples) {
    weight += sample.w;
    l += sample.lab[0] * sample.w;
    a += sample.lab[1] * sample.w;
    b += sample.lab[2] * sample.w;
  }
  if (weight <= 0) return samples[0]?.lab ?? [0.5, 0, 0];
  return [l / weight, a / weight, b / weight];
}

function sampleArt(rgba: Uint8Array, width: number, height: number): Sample[] {
  const cols = Math.min(SAMPLE, Math.max(1, width));
  const rows = Math.min(SAMPLE, Math.max(1, height));
  const samples: Sample[] = [];
  for (let y = 0; y < rows; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / rows));
    for (let x = 0; x < cols; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / cols));
      const offset = (sourceY * width + sourceX) * 4;
      if ((rgba[offset + 3] ?? 255) < 16) continue;
      const lab = rgbToOklab([rgba[offset] ?? 0, rgba[offset + 1] ?? 0, rgba[offset + 2] ?? 0]);
      const chroma = Math.hypot(lab[1], lab[2]);
      samples.push({ lab, chroma, w: 0.3 + chroma * 6 });
    }
  }
  return samples;
}

/**
 * Saturated hue peaks, strongest first. A bin only needs a small share of the
 * picture, so a yellow highlight is not dropped for being rare.
 */
function huePeaks(samples: readonly Sample[]): Peak[] {
  const bins = Array.from({ length: HUE_BINS }, () => ({
    n: 0,
    weight: 0,
    l: 0,
    a: 0,
    b: 0,
  }));
  for (const sample of samples) {
    if (sample.chroma < 0.05) continue;
    const hue = Math.atan2(sample.lab[2], sample.lab[1]);
    const index = Math.floor(((hue + Math.PI) / (2 * Math.PI)) * HUE_BINS) % HUE_BINS;
    const bin = bins[index];
    const weight = sample.chroma;
    bin.n += 1;
    bin.weight += weight;
    bin.l += sample.lab[0] * weight;
    bin.a += sample.lab[1] * weight;
    bin.b += sample.lab[2] * weight;
  }
  const ranked = bins
    .map((bin, index) => ({ bin, index }))
    .filter(({ bin }) => bin.n >= 2 && bin.n / samples.length >= 0.005)
    .sort((left, right) => right.bin.weight - left.bin.weight);
  const chosen: number[] = [];
  const peaks: Peak[] = [];
  for (const { bin, index } of ranked) {
    const crowded = chosen.some((other) => {
      const gap = Math.abs(index - other);
      return Math.min(gap, HUE_BINS - gap) <= 1;
    });
    if (crowded) continue;
    chosen.push(index);
    peaks.push({
      lab: [bin.l / bin.weight, bin.a / bin.weight, bin.b / bin.weight],
      weight: bin.weight,
    });
  }
  return peaks;
}

function farthest(samples: readonly Sample[], centers: readonly Lab[]): Lab | null {
  let best: Lab | null = null;
  let bestScore = 0;
  for (const sample of samples) {
    let nearest = Infinity;
    for (const center of centers) nearest = Math.min(nearest, labDistance(center, sample.lab));
    const score = sample.w * nearest * nearest;
    if (score > bestScore) {
      bestScore = score;
      best = sample.lab;
    }
  }
  return bestScore >= 0.001 ? best : null;
}

function pushIfFar(centers: Lab[], candidate: Lab, minDistance: number, limit: number): void {
  if (centers.length >= limit) return;
  if (centers.some((center) => labDistance(center, candidate) < minDistance)) return;
  centers.push(candidate);
}

/**
 * Vivid peaks first, then the heavy ones. A bright yellow accent is often
 * lighter in pixel weight than the blue around it, and a later average would
 * pull that peak back into the surrounding hue.
 */
function selectPeaks(peaks: readonly Peak[], limit: number): Peak[] {
  const chromaOf = (peak: Peak) => Math.hypot(peak.lab[1], peak.lab[2]);
  const chosen: Peak[] = [];
  const vivid = peaks
    .filter((peak) => chromaOf(peak) >= 0.12)
    .slice()
    .sort((left, right) => chromaOf(right) - chromaOf(left));
  const vividSlots = Math.min(vivid.length, Math.max(1, Math.ceil(limit / 2)));
  const consider = (peak: Peak, cap: number) => {
    if (chosen.length >= cap) return;
    if (chosen.some((other) => labDistance(other.lab, peak.lab) < 0.06)) return;
    chosen.push(peak);
  };
  for (const peak of vivid) consider(peak, vividSlots);
  for (const peak of peaks) consider(peak, limit);
  return chosen;
}

function buildCenters(samples: readonly Sample[], count: number): Lab[] {
  if (count <= 1) return [weightedMean(samples)];
  const centers: Lab[] = [];
  for (const peak of selectPeaks(huePeaks(samples), Math.max(1, count - 1))) {
    pushIfFar(centers, peak.lab, 0.055, count - 1);
  }
  const byLightness = samples.slice().sort((left, right) => left.lab[0] - right.lab[0]);
  const slice = Math.max(1, Math.floor(byLightness.length * 0.12));
  pushIfFar(centers, weightedMean(byLightness.slice(0, slice)), 0.06, count);
  pushIfFar(centers, weightedMean(byLightness.slice(byLightness.length - slice)), 0.06, count);
  while (centers.length < count) {
    const next = farthest(samples, centers);
    if (!next) break;
    const nearest = Math.min(...centers.map((center) => labDistance(center, next)));
    if (nearest < 0.045) break;
    centers.push(next);
  }
  return centers.length ? centers : [weightedMean(samples)];
}

function matchDistinct(centers: readonly Lab[], stock: readonly PaletteFilament[]): PaletteFilament[] {
  const palette = stock.map((filament) => ({ filament, lab: rgbToOklab(hexToRgb(filament.hex)) }));
  const ranked = centers
    .map((lab) => ({ lab, chroma: Math.hypot(lab[1], lab[2]) }))
    .sort((left, right) => right.chroma - left.chroma);
  const used = new Set<string>();
  const chosen: PaletteFilament[] = [];
  for (const center of ranked) {
    let best: { filament: PaletteFilament; distance: number } | null = null;
    for (const entry of palette) {
      if (used.has(entry.filament.id)) continue;
      const distance = labDistance(center.lab, entry.lab);
      if (!best || distance < best.distance) best = { filament: entry.filament, distance };
    }
    if (!best) break;
    // A leftover centre that is far from every remaining spool is a second
    // copy of a colour we already matched, not a new hue.
    if (chosen.length >= 1 && best.distance > 0.26) continue;
    used.add(best.filament.id);
    chosen.push(best.filament);
  }
  if (chosen.length === 0) chosen.push(stock[0]);
  return chosen;
}
