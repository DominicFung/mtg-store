import JSZip from 'jszip';
import { Filament } from './filamentCatalogue';
import { NOMINAL_LAYER_MM } from './hueforge';
import {
  buildHueforgeMeshes,
  encodeBinaryStl,
  gridCells,
  PrintSettings,
  resolvePrintSize,
} from './printGeometry';
import { renderLayeredCrops } from './renderLayers';
import { loadImage, sampleStretchedLuminance } from './sampleLuminance';

export type BundleInput = {
  crops: [string, string, string];
  layered: [string, string, string];
  layers: Filament[];
  boundaries: number[];
  settings: PrintSettings;
  settingsSource: 'api' | 'defaults';
};

function putPng(zip: JSZip, name: string, dataUrl: string): boolean {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return false;
  zip.file(name, match[1], { base64: true });
  return true;
}

export async function buildPrintBundle(input: BundleInput): Promise<JSZip> {
  if (!input.crops[0]) throw new Error('Crop the artwork before downloading');
  const decoded = await loadImage(input.crops[0]);
  const cropWidthPx = decoded.naturalWidth;
  const cropHeightPx = decoded.naturalHeight;
  if (cropWidthPx < 2 || cropHeightPx < 2) throw new Error('The front crop is too small to mesh');

  const size = resolvePrintSize(cropWidthPx, cropHeightPx, input.settings);
  const grid = gridCells(size.innerWidthMm, size.innerHeightMm, input.settings.nozzleSize);
  const sampled = await sampleStretchedLuminance(input.crops[0], grid.cols + 1, grid.rows + 1);
  const built = buildHueforgeMeshes({
    cropWidthPx,
    cropHeightPx,
    luminance: sampled.luma,
    filaments: input.layers.map((layer) => ({ name: layer.name, hex: layer.hex, td: layer.td })),
    boundaries: input.boundaries,
    settings: input.settings,
    settingsSource: input.settingsSource === 'api' ? 'appsync getPrintSettings' : 'built-in defaults',
    grid: { cols: grid.cols, rows: grid.rows },
  });

  let layered = input.layered;
  if (!layered[0] || !layered[1] || !layered[2]) {
    layered = await renderLayeredCrops(input.crops, input.layers, input.boundaries);
  }

  const zip = new JSZip();
  zip.file('backing.stl', encodeBinaryStl(built.backing, 'backing'));
  zip.file('relief.stl', encodeBinaryStl(built.relief, 'relief'));
  zip.file('frame.stl', encodeBinaryStl(built.frame, 'frame'));
  zip.file('details.txt', built.details);
  input.crops.forEach((url, index) => {
    putPng(zip, `crop-${index + 1}.png`, url);
  });
  layered.forEach((url, index) => {
    putPng(zip, `layered-${index + 1}.png`, url);
  });
  zip.file('filament-layers.json', JSON.stringify({
    note: 'Bottom (printed first) to top. hex and td may still be approximate placeholders.',
    previewNominalLayerMm: NOMINAL_LAYER_MM,
    print: {
      layerHeightMm: input.settings.layerHeight,
      baseLayerHeightMm: input.settings.baseLayerHeight,
      maxWidthMm: input.settings.width,
      maxHeightMm: input.settings.height,
      nozzleSizeMm: input.settings.nozzleSize,
      outerWidthMm: built.size.widthMm,
      outerHeightMm: built.size.heightMm,
      reliefWidthMm: built.size.innerWidthMm,
      reliefHeightMm: built.size.innerHeightMm,
      frameInsetMm: built.size.insetMm,
      settingsSource: input.settingsSource,
    },
    swaps: built.swaps,
    layers: input.layers.map((layer, index) => ({
      index,
      role: index === 0 ? 'backing' : index === input.layers.length - 1 ? 'highlight' : 'mid',
      id: layer.id,
      name: layer.name,
      hex: layer.hex,
      td: layer.td,
      approximate: layer.approximate,
      inStock: layer.inStock,
      brand: layer.brand,
      material: layer.material,
      finish: layer.finish,
      luminanceMin: index === 0 ? 0 : input.boundaries[index - 1],
      luminanceMax: index === input.layers.length - 1 ? 1 : input.boundaries[index],
    })),
  }, null, 2));
  return zip;
}

export async function downloadPrintBundle(input: BundleInput): Promise<void> {
  const zip = await buildPrintBundle(input);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deck-box-hueforge.zip';
  link.click();
  URL.revokeObjectURL(url);
}
