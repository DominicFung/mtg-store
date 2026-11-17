import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { colorCoreLayerCount } from '../app/lib/colourCore';
import { exampleEndLayers, exampleLayers } from '../app/lib/exampleDesign';
import { MOCK_FILAMENTS } from '../app/lib/filamentCatalogue';
import { toCoreStops } from '../app/lib/renderLayers';
import { buildFaceMesh, LAUNCH_PROFILES, profileToSettings } from '../app/lib/printGeometry';

const FACES = [
  { name: 'right', file: 'right-1.png' },
  { name: 'back', file: 'back-2.png' },
  { name: 'left', file: 'left-3.png' },
] as const;

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const outDir = resolve(arg('--out', '/tmp/example-relief'));
const maxDepth = Number(arg('--max-depth', '2'));
const imageDir = resolve(arg('--images', new URL('../public/examples/winter-dogs/', import.meta.url).pathname));
mkdirSync(outDir, { recursive: true });

const settings = {
  ...profileToSettings(LAUNCH_PROFILES[0]),
  minDepth: 0.25,
  maxDepth,
  brightnessAdjust: 0,
};
const layers = exampleLayers(MOCK_FILAMENTS);
const stops = toCoreStops(layers, exampleEndLayers(colorCoreLayerCount(settings)));
const report = [];

for (const face of FACES) {
  const png = PNG.sync.read(readFileSync(resolve(imageDir, face.file)));
  const mesh = buildFaceMesh({
    rgba: png.data,
    imageWidth: png.width,
    imageHeight: png.height,
    settings,
    stops,
    maxTriangles: Number.POSITIVE_INFINITY,
    header: 'colour core',
  });
  const dest = resolve(outDir, `${face.name}.stl`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, mesh.stl);
  report.push({
    face: face.name,
    png: [png.width, png.height],
    widthMm: mesh.widthMm,
    heightMm: mesh.heightMm,
    cols: mesh.cols,
    rows: mesh.rows,
    triangles: mesh.triangles,
    actualDepthMm: mesh.actualDepthMm,
    layerCount: mesh.layerCount,
    stl: dest,
  });
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify({ maxDepth, stops: stops.map((stop) => stop.endLayer), faces: report }, null, 2));
console.log(JSON.stringify({ maxDepth, layerCount: colorCoreLayerCount(settings), faces: report }));
