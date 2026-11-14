import JSZip from 'jszip';
import { Filament } from './filamentCatalogue';
import {
  colorCoreLayerCount,
  formatDetails,
  formatSwapDepth,
  layerTopMm,
  shortFilamentName,
  TRANSMISSION_DENSITY,
} from './hueforge';
import { FACE_NAMES, FaceName, modelSizeForCrop, PrintSettings } from './printGeometry';
import { renderLayeredCrops, toCoreStops } from './renderLayers';
import { buildFaceMeshAsync } from './stlClient';
import { loadImage } from './sampleLuminance';

export type BundleInput = {
  crops: [string, string, string];
  layered: [string, string, string];
  layers: Filament[];
  stops: number[];
  settings: PrintSettings;
  settingsSource: 'api' | 'defaults';
  projectBase?: string;
};

const FACE_PROJECT: Record<FaceName, string> = {
  front: 'front',
  spine: 'spine',
  back: 'back',
};

function putPng(zip: JSZip, name: string, dataUrl: string): boolean {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return false;
  zip.file(name, match[1], { base64: true });
  return true;
}

async function raster(src: string, maxEdge: number): Promise<{
  rgba: Uint8Array;
  rasterWidth: number;
  rasterHeight: number;
  cropWidth: number;
  cropHeight: number;
}> {
  const image = await loadImage(src);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const rasterWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const rasterHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not read the crop');
  context.drawImage(image, 0, 0, rasterWidth, rasterHeight);
  const data = context.getImageData(0, 0, rasterWidth, rasterHeight).data;
  return {
    rgba: new Uint8Array(data),
    rasterWidth,
    rasterHeight,
    cropWidth: image.naturalWidth,
    cropHeight: image.naturalHeight,
  };
}

export async function buildPrintBundle(input: BundleInput): Promise<JSZip> {
  if (input.crops.some((crop) => !crop)) throw new Error('Crop all three faces before downloading');
  if (input.layers.length === 0) throw new Error('Choose at least one filament');
  const stops = toCoreStops(input.layers, input.stops);
  const base = input.projectBase ?? 'deck-box';
  let layered = input.layered;
  if (!layered[0] || !layered[1] || !layered[2]) {
    layered = await renderLayeredCrops(input.crops, input.layers, input.stops, input.settings);
  }

  const zip = new JSZip();
  const details: string[] = [];
  const faces: Array<Record<string, unknown>> = [];

  for (let index = 0; index < FACE_NAMES.length; index += 1) {
    const face = FACE_NAMES[index];
    const sampled = await raster(input.crops[index], 900);
    const size = modelSizeForCrop(sampled.cropWidth, sampled.cropHeight, input.settings.height);
    const project = `${base}-${FACE_PROJECT[face]}.hfp`;
    const mesh = await buildFaceMeshAsync({
      rgba: sampled.rgba,
      imageWidth: sampled.rasterWidth,
      imageHeight: sampled.rasterHeight,
      cropWidthPx: sampled.cropWidth,
      cropHeightPx: sampled.cropHeight,
      settings: input.settings,
      stops,
      header: project,
    });
    zip.file(`${face}.stl`, mesh.stl);
    details.push(formatDetails({
      projectName: project,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      settings: input.settings,
      stops,
    }));
    faces.push({
      face,
      project,
      stl: `${face}.stl`,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      cropPx: [sampled.cropWidth, sampled.cropHeight],
      grid: [mesh.cols, mesh.rows],
      stepMm: mesh.stepMm,
      triangles: mesh.triangles,
      actualDepthMm: mesh.actualDepthMm,
    });
  }

  zip.file('details.txt', details.join('\n'));
  input.crops.forEach((url, index) => {
    putPng(zip, `crop-${index + 1}.png`, url);
  });
  layered.forEach((url, index) => {
    putPng(zip, `layered-${index + 1}.png`, url);
  });

  const layerCount = colorCoreLayerCount(input.settings);
  zip.file('filament-layers.json', JSON.stringify({
    note: 'One HueForge colour-core STL per cropped face (front, spine, back). Stops are shared. The bottom filament prints first.',
    interpretation: 'Dominic asked for 3 STLs. This zip treats that as one watertight heightmap per box face, not a backing/relief/frame split of a single face.',
    transmission: {
      model: '0.05 ** ((thicknessMm / td) * density)',
      density: TRANSMISSION_DENSITY,
      meaning: 'TD is the thickness that would block 95% of the light. density 10 matches the Brigid colour core; density 1 is the wiki curve and stays too transparent for these stacks.',
    },
    luminance: 'Standard BT.601 luminance, one 3x3 smooth, stretched from the image black to white onto min depth .. actual depth. Heights are continuous, not snapped to layers. The +X and +Y edges are a one-cell lip at layer height and the back is flat at Z 0.',
    print: {
      layerHeightMm: input.settings.layerHeight,
      baseLayerHeightMm: input.settings.baseLayerHeight,
      minDepthMm: input.settings.minDepth,
      maxDepthMm: input.settings.maxDepth,
      borderWidthMm: input.settings.borderWidth,
      borderDepthMm: input.settings.borderDepth,
      detailSizeMm: input.settings.detailSize,
      faceHeightMm: input.settings.height,
      nominalWidthMm: input.settings.width,
      nozzleSizeMm: input.settings.nozzleSize,
      layerCount,
      settingsSource: input.settingsSource,
    },
    stops: stops.map((stop, index) => ({
      index,
      endLayer: stop.endLayer,
      depthMm: layerTopMm(stop.endLayer, input.settings),
      depthLabel: formatSwapDepth(stop.endLayer, input.settings),
      type: stop.filament.type ?? 'PLA',
      brand: stop.filament.brand,
      name: shortFilamentName(stop.filament),
      td: stop.filament.td,
      hex: input.layers[index]?.hex,
      id: input.layers[index]?.id,
    })),
    faces,
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
