import { readFileSync, writeFileSync } from 'node:fs';
import { colorCoreLayerCount, layerTopMm } from '../app/lib/colourCore';
import { buildFaceMesh, DEFAULT_PRINT_SETTINGS, meshGrid, modelSizeForCrop } from '../app/lib/printGeometry';

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

const width = Number(arg('--width'));
const height = Number(arg('--height'));
const rgba = new Uint8Array(readFileSync(arg('--rgba')));
const out = arg('--out');
const endLayer = Number(arg('--top') || '50');
const settings = { ...DEFAULT_PRINT_SETTINGS };
const size = modelSizeForCrop(width, height, settings.height);
const grid = meshGrid(size.widthMm, size.heightMm, settings.detailSize, 50_000_000);
const mesh = buildFaceMesh({
  rgba,
  imageWidth: width,
  imageHeight: height,
  settings,
  stops: [{
    filament: { type: 'PLA', brand: 'Test', name: 'White', td: 5 },
    rgb: [255, 255, 255],
    endLayer,
  }],
  smoothing: 1,
  maxTriangles: 50_000_000,
  header: 'colour-core',
});
writeFileSync(`${out}.stl`, mesh.stl);
const meta = {
  widthMm: mesh.widthMm,
  heightMm: mesh.heightMm,
  cols: mesh.cols,
  rows: mesh.rows,
  triangles: mesh.triangles,
  expectedTriangles: grid.triangles,
  layerCount: colorCoreLayerCount(settings),
  actualDepthMm: layerTopMm(endLayer, settings),
};
writeFileSync(`${out}-stl.json`, JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));
