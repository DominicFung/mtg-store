import { colorAtLayer, colorCoreLayerCount, evenStops, hexToRgb, standardLuminance, stretchToUnit, type CoreStop, type LayerSettings, type Rgb } from './hueforge';

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

const SAMPLE = 36;

function rgbDistance(left: Rgb, right: Rgb): number {
  const dr = left[0] - right[0];
  const dg = left[1] - right[1];
  const db = left[2] - right[2];
  return dr * dr + dg * dg + db * db;
}

function mean(colors: Rgb[]): Rgb {
  if (colors.length === 0) return [128, 128, 128];
  const sum = colors.reduce((acc, color) => [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2]], [0, 0, 0]);
  return [sum[0] / colors.length, sum[1] / colors.length, sum[2] / colors.length];
}

/**
 * Pick an in-stock stack whose HueForge blend tracks the art.
 * Bands are equal slices of stretched luminance. The backing is the filament
 * closest to the darkest band. Each layer above is the filament that, blended
 * with its transmission distance, leaves that band's average colour.
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
  const endLayers = evenStops(count, layerCount);
  const { colors, luma } = sampleArt(input.rgba, input.width, input.height);
  const unit = stretchToUnit(luma);
  const bands: Rgb[][] = Array.from({ length: count }, () => []);
  for (let index = 0; index < unit.length; index += 1) {
    const band = Math.min(count - 1, Math.floor(unit[index] * count));
    bands[band].push(colors[index]);
  }
  const targets = bands.map((band, index) => mean(band.length ? band : [colors[index % colors.length] ?? [128, 128, 128]]));
  const chosen: PaletteFilament[] = [];
  const stops: CoreStop[] = [];
  for (let index = 0; index < count; index += 1) {
    const target = targets[index];
    let best = stock[0];
    let bestScore = Infinity;
    for (const filament of stock) {
      const candidate: CoreStop = {
        filament: { type: filament.type, brand: filament.brand, name: filament.name, td: filament.td },
        rgb: hexToRgb(filament.hex),
        endLayer: endLayers[index],
      };
      const preview = colorAtLayer(endLayers[index], [...stops, candidate], input.settings);
      let score = rgbDistance(preview, target);
      if (index === 0) score += standardLuminance(...hexToRgb(filament.hex)) * 40;
      if (chosen[chosen.length - 1]?.id === filament.id) score += 30;
      if (score < bestScore) {
        best = filament;
        bestScore = score;
      }
    }
    chosen.push(best);
    stops.push({
      filament: { type: best.type, brand: best.brand, name: best.name, td: best.td },
      rgb: hexToRgb(best.hex),
      endLayer: endLayers[index],
    });
  }
  return { ids: chosen.map((filament) => filament.id), endLayers };
}

function sampleArt(rgba: Uint8Array, width: number, height: number): { colors: Rgb[]; luma: Float32Array } {
  const cols = Math.min(SAMPLE, Math.max(1, width));
  const rows = Math.min(SAMPLE, Math.max(1, height));
  const colors: Rgb[] = [];
  const luma = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / rows));
    for (let x = 0; x < cols; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / cols));
      const offset = (sourceY * width + sourceX) * 4;
      const color: Rgb = [rgba[offset] ?? 0, rgba[offset + 1] ?? 0, rgba[offset + 2] ?? 0];
      colors.push(color);
      luma[y * cols + x] = standardLuminance(color[0], color[1], color[2]);
    }
  }
  return { colors, luma };
}
