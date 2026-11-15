import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFaceMesh,
  buildVertexHeights,
  decodeBinaryStl,
  DEFAULT_PRINT_SETTINGS,
  encodeHeightfieldStl,
  meshGrid,
  meshTriangleCount,
  modelSizeForCrop,
  triangleBounds,
  type Triangle,
} from './printGeometry';
import {
  applyBrightness,
  colorAtLayer,
  colorCoreLayerCount,
  evenStops,
  formatDetails,
  hexToRgb,
  insertStop,
  layerForDepth,
  layerForLuminance,
  layerTopMm,
  moveStop,
  removeStop,
  resolveSmoothPasses,
  shortFilamentName,
  transmission,
  TRANSMISSION_DENSITY,
  type CoreStop,
  type LayerSettings,
} from './hueforge';
import { LAUNCH_PROFILES, profileToSettings, resolveProfile } from './printGeometry';
import * as sharedMesh from '../../../packages/print-core/src/printGeometry';

const settings: LayerSettings = {
  layerHeight: 0.04,
  baseLayerHeight: 0.09,
  minDepth: 0.25,
  maxDepth: 2.01,
};

const printSettings = { ...DEFAULT_PRINT_SETTINGS };

function stop(type: string, brand: string, name: string, td: number, endLayer: number, hex: string): CoreStop {
  return { filament: { type, brand, name, td }, rgb: hexToRgb(hex), endLayer };
}

const fireStops: CoreStop[] = [
  stop('PLA', 'BambuLab Basic', 'Blue', 4, 7, '#1F4EAE'),
  stop('PLA', 'Jessie Premium', 'Red Ice', 8.6, 17, '#E24B6A'),
  stop('PLA', 'Hatchbox', 'Pink', 12, 23, '#F48FB1'),
  stop('PLA', 'BambuLab Basic', 'Orange', 7, 32, '#F58220'),
  stop('PLA', 'BambuLab Matte', 'Lemon Yellow', 4, 41, '#F5E642'),
  stop('PLA', 'BambuLab Basic', 'Jade White', 5, 50, '#F3F0E6'),
];

const brigidStops: CoreStop[] = [
  stop('PLA', 'BambuLab Basic', 'Black', 0.6, 4, '#10100E'),
  stop('PLA', 'Jessie Premium', 'Green Ice', 11, 7, '#04AF76'),
  stop('PLA', 'Kexcelled', 'Bluish Green', 3, 10, '#365927'),
  stop('PLA', 'BambuLab Matte', 'Dark Brown', 2, 13, '#7D6556'),
  stop('PLA', 'Jessie Premium', 'Red Ice', 8.6, 15, '#862E26'),
  stop('PLA', 'Hatchbox', 'Pink', 12, 21, '#FF81BA'),
  stop('PETG', 'GEETECH', 'Gray', 3, 26, '#BCBCBC'),
  stop('PLA', 'BambuLab Matte', 'Ice Blue', 3.5, 35, '#8BD5EE'),
  stop('PETG', 'JAYO', 'White', 6, 50, '#FFFFFF'),
];

const FIRE_DETAILS = `Project: fire-case-3-right.hfp
Print at 100% infill with a layer height of 0.04mm with a base layer of 0.09mm

 The Model is 94.67x105.45mm in size
 You may print at higher layer heights below the Min Depth of 0.25mm
 The Max Depth is 2mm and the Actual Depth is 2mm

Filaments Used:
	PLA BambuLab Basic Blue Transmission Distance: 4
	PLA Jessie Premium Red Ice Transmission Distance: 8.6
	PLA Hatchbox Pink Transmission Distance: 12
	PLA BambuLab Basic Orange Transmission Distance: 7
	PLA BambuLab Matte Lemon Yellow Transmission Distance: 4
	PLA BambuLab Basic Jade White Transmission Distance: 5
This print uses 6 unique filaments

Swap Instructions:
	Start with Blue
	At layer #7 (0.33mm) swap to Red Ice
	At layer #17 (0.73mm) swap to Pink
	At layer #23 (0.97mm) swap to Orange
	At layer #32 (1.33mm) swap to Lemon Yellow
	At layer #41 (1.69mm) swap to Jade White for the rest.
`;

const BRIGID_DETAILS = `Project: brigid-case-2-back.hfp
Print at 100% infill with a layer height of 0.04mm with a base layer of 0.09mm

 The Model is 82.44x105.45mm in size
 You may print at higher layer heights below the Min Depth of 0.25mm
 The Max Depth is 2mm and the Actual Depth is 2mm

Filaments Used:
	PLA BambuLab Basic Black Transmission Distance: 0.6
	PLA Jessie Premium Green Ice Transmission Distance: 11
	PLA Kexcelled Bluish Green Transmission Distance: 3
	PLA BambuLab Matte Dark Brown Transmission Distance: 2
	PLA Jessie Premium Red Ice Transmission Distance: 8.6
	PLA Hatchbox Pink Transmission Distance: 12
	PETG GEETECH Gray Transmission Distance: 3
	PLA BambuLab Matte Ice Blue Transmission Distance: 3.5
	PETG JAYO White Transmission Distance: 6
This print uses 9 unique filaments

!!!!  It appears you have mixed filament types.  Be certain this is what you want.  !!!!!

Swap Instructions:
	Start with Black
	At layer #4 (0.21mm) swap to Green Ice
	At layer #7 (0.33mm) swap to Bluish Green
	At layer #10 (0.45mm) swap to Dark Brown
	At layer #13 (0.57mm) swap to Red Ice
	At layer #15 (0.65mm) swap to Pink
	At layer #21 (0.89mm) swap to Gray
	At layer #26 (1.09mm) swap to Ice Blue
	At layer #35 (1.45mm) swap to White for the rest.
`;

function nearly(actual: number, expected: number, epsilon = 1e-3) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

test('the browser mesh and the shared package are the same function', () => {
  assert.equal(buildFaceMesh, sharedMesh.buildFaceMesh);
  assert.equal(meshGrid, sharedMesh.meshGrid);
});

test('smoothing 4 is one 3x3 on a 0.10 mm grid and none on a 0.20 mm grid', () => {
  assert.equal(resolveSmoothPasses(0.1, undefined), 1);
  assert.equal(resolveSmoothPasses(0.2, undefined), 0);
  assert.equal(resolveSmoothPasses(0.1, 0), 0);
  assert.equal(resolveSmoothPasses(0.2, 1), 1);
});

test('brightness adjust pulls white down and leaves black on min depth', () => {
  const shifted = applyBrightness(Float32Array.of(0, 0.5, 1), -0.14);
  nearly(shifted[0], 0, 1e-6);
  nearly(shifted[1], 0.36, 1e-6);
  nearly(shifted[2], 0.86, 1e-6);
  const white = 0.24 + shifted[2] * (2.08 - 0.24);
  nearly(white, 1.8224, 1e-4);
});

test('the launch profiles derive 50 layers at 0.2 mm and layer 24 at max depth for 0.4 mm', () => {
  const fine = resolveProfile(LAUNCH_PROFILES[0]);
  const coarse = resolveProfile(LAUNCH_PROFILES[1]);
  assert.equal(fine.layerCount, 50);
  assert.equal(fine.layersAtMaxDepth, 49);
  assert.equal(fine.isDefault, true);
  assert.equal(coarse.layersAtMaxDepth, 24);
  assert.equal(layerTopMm(24, coarse), 2);
  assert.equal(coarse.layerCount, 25);
  nearly(coarse.coreTopMm, 2.08, 1e-6);
  assert.equal(coarse.brightnessAdjust, -0.14);
  const settings = profileToSettings(coarse);
  assert.equal(settings.detailSize, 0.2);
  assert.equal(settings.nozzleSize, 0.4);
  assert.equal(settings.height, 105.45);
});

test('the colour core is 50 layers and layer tops match the slider depths', () => {
  assert.equal(colorCoreLayerCount(settings), 50);
  assert.equal(layerTopMm(1, settings), 0.09);
  assert.equal(layerTopMm(4, settings), 0.21);
  assert.equal(layerTopMm(7, settings), 0.33);
  assert.equal(layerTopMm(10, settings), 0.45);
  assert.equal(layerTopMm(13, settings), 0.57);
  assert.equal(layerTopMm(15, settings), 0.65);
  assert.equal(layerTopMm(17, settings), 0.73);
  assert.equal(layerTopMm(21, settings), 0.89);
  assert.equal(layerTopMm(23, settings), 0.97);
  assert.equal(layerTopMm(26, settings), 1.09);
  assert.equal(layerTopMm(32, settings), 1.33);
  assert.equal(layerTopMm(35, settings), 1.45);
  assert.equal(layerTopMm(41, settings), 1.69);
  assert.equal(layerTopMm(50, settings), 2.05);
  assert.equal(layerForDepth(0.25, settings), 5);
  assert.equal(layerForDepth(2.01, settings), 49);
  assert.equal(layerTopMm(49, settings), 2.01);
});

test('crop aspect at the shared face height reproduces both ground-truth plates', () => {
  const right = modelSizeForCrop(650, 724, 105.45);
  assert.equal(right.widthMm, 94.67);
  assert.equal(right.heightMm, 105.45);
  const back = modelSizeForCrop(480, 614, 105.45);
  assert.equal(back.widthMm, 82.44);
  assert.equal(back.heightMm, 105.45);
});

test('fire-case details.txt matches HueForge byte for byte', () => {
  const text = formatDetails({
    projectName: 'fire-case-3-right.hfp',
    widthMm: 94.67,
    heightMm: 105.45,
    settings,
    stops: fireStops,
  });
  assert.equal(text, FIRE_DETAILS);
});

test('brigid-case details.txt matches HueForge byte for byte, including the mixed-type warning', () => {
  const text = formatDetails({
    projectName: 'brigid-case-2-back.hfp',
    widthMm: 82.44,
    heightMm: 105.45,
    settings,
    stops: brigidStops,
  });
  assert.equal(text, BRIGID_DETAILS);
});

test('the project name is the only token that changes between the two plates', () => {
  const renamed = formatDetails({
    projectName: 'custom-name.hfp',
    widthMm: 94.67,
    heightMm: 105.45,
    settings,
    stops: fireStops,
  });
  assert.equal(renamed, FIRE_DETAILS.replace('fire-case-3-right.hfp', 'custom-name.hfp'));
});

test('catalogue product names shorten to the colour, and a missing type is PLA', () => {
  assert.equal(shortFilamentName({ name: 'Elegoo PLA Red', brand: 'Elegoo', td: 1 }), 'Red');
  assert.equal(shortFilamentName({ name: 'Ice Blue', brand: 'BambuLab Matte', td: 3.5 }), 'Ice Blue');
  const text = formatDetails({
    projectName: 'one.hfp',
    widthMm: 10,
    heightMm: 10,
    settings,
    stops: [{ filament: { name: 'Elegoo PLA Red', brand: 'Elegoo', td: 3.4 }, rgb: [1, 2, 3], endLayer: 50 }],
  });
  assert.match(text, /PLA Elegoo Red Transmission Distance: 3\.4/);
  assert.match(text, /Start with Red/);
  assert.doesNotMatch(text, /mixed filament types/);
});

test('a low TD covers on the next layer and a high TD is still mixed', () => {
  const under = stop('PLA', 'Test', 'Black', 0.2, 10, '#101010');
  const opaque = stop('PLA', 'Test', 'Red', 0.04, 40, '#E02020');
  const glassy = stop('PLA', 'Test', 'Red', 8, 40, '#E02020');
  const snapped = colorAtLayer(11, [under, opaque], settings);
  const firstGlaze = colorAtLayer(11, [under, glassy], settings);
  const laterGlaze = colorAtLayer(40, [under, glassy], settings);
  assert.ok(snapped[0] > 200, `low TD should already be red, got ${snapped}`);
  assert.ok(firstGlaze[0] < 90, `high TD should still show the base, got ${firstGlaze}`);
  assert.ok(laterGlaze[0] > firstGlaze[0] + 80, `high TD should arrive by the end of its range, got ${laterGlaze}`);
  const midLayer = colorAtLayer(20, [under, glassy], settings);
  const linearMid = firstGlaze[0] + (laterGlaze[0] - firstGlaze[0]) * (9 / 29);
  assert.ok(midLayer[0] > linearMid + 15, `Beer-Lambert should front-load the blend, got ${midLayer[0]} vs linear ${linearMid}`);
});

test('density 10 reaches the Brigid ice-blue slider; density 1 does not', () => {
  const atSlider = colorAtLayer(35, brigidStops, settings);
  assert.ok(Math.abs(atSlider[0] - 139) < 20, `red ${atSlider[0]}`);
  assert.ok(Math.abs(atSlider[1] - 213) < 20, `green ${atSlider[1]}`);
  assert.ok(Math.abs(atSlider[2] - 238) < 20, `blue ${atSlider[2]}`);
  const white = colorAtLayer(50, brigidStops, settings);
  assert.ok(white[0] > 240 && white[1] > 240 && white[2] > 240, `top ${white}`);
  const weak = transmission(0.36, 3.5, 1);
  const fitted = transmission(0.36, 3.5, TRANSMISSION_DENSITY);
  assert.ok(weak > 0.7, `unstiffened ice blue still transmits ${weak}`);
  assert.ok(fitted < 0.1, `fitted ice blue still transmits ${fitted}`);
});

test('a bright pixel is a taller layer than a dark pixel, and both sit on a layer top', () => {
  const dark = layerForLuminance(0, 5, 50);
  const bright = layerForLuminance(1, 5, 50);
  assert.equal(dark, 5);
  assert.equal(bright, 50);
  assert.ok(layerTopMm(bright, settings) > layerTopMm(dark, settings));
  const mid = layerTopMm(layerForLuminance(0.5, 5, 50), settings);
  const tops = Array.from({ length: 50 }, (_, index) => layerTopMm(index + 1, settings));
  assert.ok(tops.some((top) => Math.abs(top - mid) < 1e-9));
});

test('stops can be inserted, dragged, and removed without leaving the core', () => {
  const start = evenStops(3, 50);
  assert.deepEqual(start, [17, 33, 50]);
  const added = insertStop(start);
  assert.equal(added.index >= 0, true);
  assert.equal(added.stops[added.stops.length - 1], 50);
  const moved = moveStop(added.stops, 0, 2, 50);
  assert.equal(moved[0], 2);
  const removed = removeStop(moved, 0);
  assert.equal(removed[removed.length - 1], 50);
  assert.equal(removed.length, moved.length - 1);
});

test('the STL matches HueForge structure: centred plate, flat back, lip on the positive edges', () => {
  const cols = 4;
  const rows = 4;
  const unit = new Float32Array([
    0, 0, 0, 0,
    0, 0, 0, 0,
    1, 1, 1, 1,
    1, 1, 1, 1,
  ]);
  const heights = buildVertexHeights({
    cols,
    rows,
    unit,
    minDepth: 0.25,
    actualDepth: 2.05,
    lipMm: 0.04,
  });
  nearly(heights[0], 0.25, 1e-5);
  nearly(heights[3], 0.25, 1e-5);
  nearly(heights[2 * 5 + 1], 2.05, 1e-5);
  nearly(heights[3 * 5 + 1], 2.05, 1e-5);
  nearly(heights[4], 0.04, 1e-6);
  nearly(heights[heights.length - 1], 0.04, 1e-6);

  const stl = encodeHeightfieldStl({ cols, rows, widthMm: 0.4, heightMm: 0.4, heights });
  assert.equal(stl.byteLength, 84 + meshTriangleCount(cols, rows) * 50);
  const triangles = decodeBinaryStl(stl);
  const bounds = triangleBounds(triangles);
  nearly(bounds.min[0], -0.2);
  nearly(bounds.max[0], 0.2);
  nearly(bounds.min[1], -0.2);
  nearly(bounds.max[1], 0.2);
  nearly(bounds.min[2], 0, 1e-5);
  nearly(bounds.max[2], 2.05, 1e-4);
  assert.equal(pairedEdges(triangles), true);
  assert.ok(signedVolume(triangles) > 0, 'winding should face outward');
  const back = triangles.filter((triangle) => triangle.verts.every((vertex) => Math.abs(vertex[2]) < 1e-6));
  assert.equal(back.length, 2 * (cols + rows));
});

test('detail size rounds the plate onto the 0.10 mm lattice HueForge exports', () => {
  const fine = meshGrid(94.67, 105.45, 0.1, 50_000_000);
  assert.equal(fine.cols, 947);
  assert.equal(fine.rows, 1055);
  assert.equal(fine.widthMm, 94.7);
  assert.equal(fine.heightMm, 105.5);
  assert.equal(fine.triangles, 2010182);
  const back = meshGrid(82.44, 105.45, 0.1, 50_000_000);
  assert.equal(back.cols, 824);
  assert.equal(back.rows, 1055);
  assert.equal(back.triangles, 1749914);
  const capped = meshGrid(94.67, 105.45, 0.1, 180_000);
  assert.ok(capped.triangles <= 180_000);
  assert.ok(capped.stepMm > 0.1);
  assert.equal(capped.widthMm, 94.7);
});

test('a real-sized face mesh is centred, flat on the back, and stops at actual depth', () => {
  const width = 32;
  const height = 36;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const bright = y < height / 2 ? 220 : 20;
      rgba[offset] = bright;
      rgba[offset + 1] = bright;
      rgba[offset + 2] = bright;
      rgba[offset + 3] = 255;
    }
  }
  const mesh = buildFaceMesh({
    rgba,
    imageWidth: width,
    imageHeight: height,
    settings: printSettings,
    stops: brigidStops,
    smoothing: 0,
    maxTriangles: 8_000,
    header: 'test',
  });
  const plate = meshGrid(
    modelSizeForCrop(width, height, printSettings.height).widthMm,
    printSettings.height,
    printSettings.detailSize,
    8_000,
  );
  assert.equal(mesh.widthMm, plate.widthMm);
  assert.equal(mesh.heightMm, plate.heightMm);
  const decoded = decodeBinaryStl(mesh.stl);
  const bounds = triangleBounds(decoded);
  nearly(bounds.min[0], -plate.widthMm / 2, 0.02);
  nearly(bounds.max[0], plate.widthMm / 2, 0.02);
  nearly(bounds.min[2], 0, 1e-4);
  nearly(bounds.max[2], 2.05, 0.05);
  assert.equal(decoded.length, mesh.triangles);
  assert.ok(mesh.triangles <= 8_000);
});

function signedVolume(triangles: Triangle[]): number {
  let volume = 0;
  for (const triangle of triangles) {
    const [a, b, c] = triangle.verts;
    volume += a[0] * (b[1] * c[2] - b[2] * c[1])
      - a[1] * (b[0] * c[2] - b[2] * c[0])
      + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return volume / 6;
}

function pairedEdges(triangles: Triangle[]): boolean {
  const counts = new Map<string, number>();
  const key = (a: Triangle['verts'][number], b: Triangle['verts'][number]) => {
    const quant = (value: number) => Math.round(value * 1000);
    const left = `${quant(a[0])},${quant(a[1])},${quant(a[2])}`;
    const right = `${quant(b[0])},${quant(b[1])},${quant(b[2])}`;
    return left < right ? `${left}|${right}` : `${right}|${left}`;
  };
  for (const triangle of triangles) {
    const [a, b, c] = triangle.verts;
    for (const edge of [[a, b], [b, c], [c, a]] as const) {
      const id = key(edge[0], edge[1]);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  for (const count of counts.values()) {
    if (count !== 2) return false;
  }
  return counts.size > 0;
}
