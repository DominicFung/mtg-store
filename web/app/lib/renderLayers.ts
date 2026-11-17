import { Filament } from './filamentCatalogue';
import { CoreStop, hexToRgb, renderBlendedRgba } from './colourCore';
import { modelSizeForCrop, PrintSettings } from './printGeometry';

export function toCoreStops(layers: readonly Filament[], endLayers: readonly number[]): CoreStop[] {
  return layers.map((layer, index) => ({
    filament: {
      type: layer.type,
      brand: layer.brand,
      name: layer.name,
      td: layer.td,
    },
    rgb: hexToRgb(layer.hex),
    endLayer: endLayers[index] ?? endLayers[endLayers.length - 1] ?? 1,
  }));
}

async function paint(
  src: string,
  stops: readonly CoreStop[],
  settings: PrintSettings,
  maxEdge: number,
): Promise<string> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return '';
  }
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const size = modelSizeForCrop(image.naturalWidth, image.naturalHeight, settings.height);
  const blended = renderBlendedRgba({
    rgba: pixels.data,
    width,
    height,
    modelWidthMm: size.widthMm,
    modelHeightMm: size.heightMm,
    stops,
    settings,
  });
  pixels.data.set(blended);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function renderLayeredCrops(
  crops: readonly [string, string, string],
  layers: readonly Filament[],
  endLayers: readonly number[],
  settings: PrintSettings,
  maxEdge = 480,
): Promise<[string, string, string]> {
  if (layers.length === 0) return ['', '', ''];
  const stops = toCoreStops(layers, endLayers);
  const rendered = await Promise.all(crops.map((src) => (src ? paint(src, stops, settings, maxEdge) : Promise.resolve(''))));
  return [rendered[0] ?? '', rendered[1] ?? '', rendered[2] ?? ''];
}
