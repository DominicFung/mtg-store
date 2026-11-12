export type Rgb = [number, number, number];

/**
 * Optical thickness, in millimetres, treated as one full colour step in the
 * preview. This is not a single printed toolpath. It is a stand-in so the
 * placeholder transmission distances still resolve into visible bands.
 */
export const NOMINAL_LAYER_MM = 6;

/** Share of each luminance band used to ease in the next filament. */
const BAND_RAMP = 0.22;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function hexToRgb(hex: string): Rgb {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((channel) => channel + channel).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [128, 128, 128];
  const parsed = Number.parseInt(full, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

/** Rec. 709 relative luminance for sRGB bytes, in 0..1. */
export function relativeLuminance(red: number, green: number, blue: number): number {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

export function stretchLuminance(luminance: number, min: number, max: number): number {
  const span = max - min;
  if (span < 0.04) return clamp01(luminance);
  return clamp01((luminance - min) / span);
}

/** 1st and 99th percentile of opaque pixels, as 0..1 luminance. */
export function luminanceBounds(luma: ArrayLike<number>, alpha: ArrayLike<number>): [number, number] {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let index = 0; index < luma.length; index += 1) {
    if (alpha[index] < 16) continue;
    const bin = Math.max(0, Math.min(255, Math.round(luma[index] * 255)));
    histogram[bin] += 1;
    count += 1;
  }
  if (count === 0) return [0, 1];
  const lowCut = count * 0.01;
  const highCut = count * 0.99;
  let seen = 0;
  let low = 0;
  for (let bin = 0; bin < 256; bin += 1) {
    seen += histogram[bin];
    if (seen >= lowCut) {
      low = bin;
      break;
    }
  }
  seen = 0;
  let high = 255;
  for (let bin = 0; bin < 256; bin += 1) {
    seen += histogram[bin];
    if (seen >= highCut) {
      high = bin;
      break;
    }
  }
  if (high - low < 8) return [0, 1];
  return [low / 255, high / 255];
}

export function equalBoundaries(layerCount: number): number[] {
  const boundaries: number[] = [];
  for (let index = 1; index < layerCount; index += 1) {
    boundaries.push(round4(index / layerCount));
  }
  return boundaries;
}

export function boundariesAfterAdd(boundaries: number[]): number[] {
  const last = boundaries.length > 0 ? boundaries[boundaries.length - 1] : 0;
  return [...boundaries, round4((last + 1) / 2)];
}

export function boundariesAfterRemove(boundaries: number[], index: number, layerCount: number): number[] {
  if (index >= layerCount - 1) return boundaries.slice(0, -1);
  return boundaries.filter((_, boundaryIndex) => boundaryIndex !== index);
}

/** Band index for a luminance. The boundary value itself stays with the lower layer. */
export function bandIndex(luminance: number, boundaries: readonly number[]): number {
  const value = clamp01(luminance);
  for (let index = 0; index < boundaries.length; index += 1) {
    if (value <= boundaries[index]) return index;
  }
  return boundaries.length;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(under: Rgb, over: Rgb, absorption: number): Rgb {
  const keep = 1 - absorption;
  return [
    under[0] * keep + over[0] * absorption,
    under[1] * keep + over[1] * absorption,
    under[2] * keep + over[2] * absorption,
  ];
}

/**
 * Colour of one pixel.
 * Layers run bottom to top. The bottom filament is an opaque backing.
 * Each higher filament covers the stack with Beer's law using its transmission
 * distance, eased in across the start of its luminance band so the regions
 * stay readable instead of becoming one smooth gradient.
 */
export function colorForLuminance(
  luminance: number,
  colors: Rgb[],
  transmissionDistances: number[],
  boundaries: number[],
): Rgb {
  if (colors.length === 0) return [128, 128, 128];
  const band = Math.min(bandIndex(luminance, boundaries), colors.length - 1);
  const edges = [0, ...boundaries, 1];
  let red = colors[0][0];
  let green = colors[0][1];
  let blue = colors[0][2];

  for (let index = 1; index <= band; index += 1) {
    const start = edges[index] ?? 0;
    const end = edges[index + 1] ?? 1;
    const span = Math.max(end - start, 1e-4);
    const frac = index < band ? 1 : clamp01((luminance - start) / span);
    const ramp = frac >= BAND_RAMP ? 1 : frac / BAND_RAMP;
    const td = Math.max(transmissionDistances[index] ?? 1, 0.05);
    const absorption = 1 - Math.exp(-(ramp * NOMINAL_LAYER_MM) / td);
    const mixed = mix([red, green, blue], colors[index], absorption);
    red = mixed[0];
    green = mixed[1];
    blue = mixed[2];
  }

  return [clampByte(red), clampByte(green), clampByte(blue)];
}

export function stackGradient(colors: Rgb[], transmissionDistances: number[], boundaries: number[], steps = 24): string {
  const stops: string[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const luminance = step / steps;
    const [red, green, blue] = colorForLuminance(luminance, colors, transmissionDistances, boundaries);
    stops.push(`rgb(${red}, ${green}, ${blue}) ${(luminance * 100).toFixed(2)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
