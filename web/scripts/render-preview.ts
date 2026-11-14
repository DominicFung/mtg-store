import { readFileSync, writeFileSync } from 'node:fs';
import {
  colorCoreLayerCount,
  hexToRgb,
  layerForLuminance,
  layerTopMm,
  luminanceFromRgba,
  minBlendLayer,
  renderBlendedRgba,
  smoothLuminance,
  smoothingRadiusPx,
  type CoreStop,
} from '../app/lib/hueforge';
import {
  buildFaceMesh,
  meshGrid,
  modelSizeForCrop,
  triangleBounds,
  decodeBinaryStl,
  DEFAULT_PRINT_SETTINGS,
  type PrintSettings,
} from '../app/lib/printGeometry';
type Preset = {
  stops: CoreStop[];
};

function stop(type: string, brand: string, name: string, td: number, endLayer: number, hex: string): CoreStop {
  return { filament: { type, brand, name, td }, rgb: hexToRgb(hex), endLayer };
}

const PRESETS: Record<string, Preset> = {
  fire: {
    stops: [
      stop('PLA', 'BambuLab Basic', 'Blue', 4, 7, '#2450B0'),
      stop('PLA', 'Jessie Premium', 'Red Ice', 8.6, 17, '#E23B55'),
      stop('PLA', 'Hatchbox', 'Pink', 12, 23, '#FF81BA'),
      stop('PLA', 'BambuLab Basic', 'Orange', 7, 32, '#FF6A13'),
      stop('PLA', 'BambuLab Matte', 'Lemon Yellow', 4, 41, '#FFE14A'),
      stop('PLA', 'BambuLab Basic', 'Jade White', 5, 50, '#F4F1E8'),
    ],
  },
  brigid: {
    stops: [
      stop('PLA', 'BambuLab Basic', 'Black', 0.6, 4, '#141412'),
      stop('PLA', 'Jessie Premium', 'Green Ice', 11, 7, '#04AF76'),
      stop('PLA', 'Kexcelled', 'Bluish Green', 3, 10, '#365927'),
      stop('PLA', 'BambuLab Matte', 'Dark Brown', 2, 13, '#7D6556'),
      stop('PLA', 'Jessie Premium', 'Red Ice', 8.6, 15, '#862E26'),
      stop('PLA', 'Hatchbox', 'Pink', 12, 21, '#FF81BA'),
      stop('PETG', 'GEETECH', 'Gray', 3, 26, '#BCBCBC'),
      stop('PLA', 'BambuLab Matte', 'Ice Blue', 3.5, 35, '#8BD5EE'),
      stop('PETG', 'JAYO', 'White', 6, 50, '#FFFFFF'),
    ],
  },
};

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

const presetName = arg('--preset');
const preset = PRESETS[presetName];
if (!preset) throw new Error(`Unknown preset ${presetName}`);
const width = Number(arg('--width'));
const height = Number(arg('--height'));
const rgba = new Uint8Array(readFileSync(arg('--rgba')));
const out = arg('--out');
const settings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };
const size = modelSizeForCrop(width, height, settings.height);
const shared = {
  rgba,
  width,
  height,
  modelWidthMm: size.widthMm,
  modelHeightMm: size.heightMm,
  stops: preset.stops,
  settings,
  smoothing: 4,
};

const flat = renderBlendedRgba(shared);
const shaded = renderBlendedRgba({ ...shared, shade: true });
writeFileSync(`${out}-flat.rgba`, flat);
writeFileSync(`${out}-shade.rgba`, shaded);

const mesh = buildFaceMesh({
  rgba,
  imageWidth: width,
  imageHeight: height,
  settings,
  stops: preset.stops,
  smoothing: 4,
});
writeFileSync(`${out}.stl`, mesh.stl);
const bounds = triangleBounds(decodeBinaryStl(mesh.stl));
const full = meshGrid(size.widthMm, size.heightMm, settings.detailSize, 50_000_000);

const heights = new Uint8ClampedArray(width * height * 4);
const minLayerZ = settings.minDepth;
const span = settings.borderDepth - minLayerZ;
const luma = smoothLuminance(
  luminanceFromRgba(rgba, width, height),
  width,
  height,
  smoothingRadiusPx(width, size.widthMm, settings.detailSize, 4),
);
const maxLayer = preset.stops[preset.stops.length - 1].endLayer;
const minLayer = Math.min(minBlendLayer(settings), maxLayer);
for (let index = 0; index < luma.length; index += 1) {
  const z = layerTopMm(layerForLuminance(luma[index], minLayer, maxLayer), settings);
  const tone = Math.round(((z - minLayerZ) / span) * 255);
  const offset = index * 4;
  heights[offset] = tone;
  heights[offset + 1] = tone;
  heights[offset + 2] = tone;
  heights[offset + 3] = 255;
}
writeFileSync(`${out}-height.rgba`, heights);

const meta = {
  preset: presetName,
  widthMm: size.widthMm,
  heightMm: size.heightMm,
  layerCount: colorCoreLayerCount(settings),
  actualDepthMm: mesh.actualDepthMm,
  triangles: mesh.triangles,
  cols: mesh.cols,
  rows: mesh.rows,
  stepMm: Number(mesh.stepMm.toFixed(4)),
  uncappedTriangles: full.triangles,
  uncappedStepMm: Number(full.stepMm.toFixed(4)),
  bounds: {
    min: bounds.min.map((value) => Number(value.toFixed(3))),
    max: bounds.max.map((value) => Number(value.toFixed(3))),
  },
};
writeFileSync(`${out}-meta.json`, JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
