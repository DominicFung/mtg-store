import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  buildHueforgeMeshes,
  decodeBinaryStl,
  DEFAULT_PRINT_SETTINGS,
  encodeAsciiStl,
  encodeBinaryStl,
  frameInsetMm,
  gridCells,
  layerStartZMm,
  layerTopZMm,
  layersForTransmission,
  planLayerSwaps,
  resolvePrintSize,
  triangleBounds,
  type PrintSettings,
  type Triangle,
} from './printGeometry';

const settings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };

function nearly(actual: number, expected: number, epsilon = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${expected}, got ${actual}`,
  );
}

function pointsOutward(triangles: Triangle[]) {
  const bounds = triangleBounds(triangles);
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  for (const triangle of triangles) {
    const vertex = triangle.verts[0];
    const outward = triangle.normal[0] * (vertex[0] - center[0])
      + triangle.normal[1] * (vertex[1] - center[1])
      + triangle.normal[2] * (vertex[2] - center[2]);
    assert.ok(outward > 1e-6, `normal ${triangle.normal} at ${vertex} points inward`);
  }
}

test('transmission distance rounds in microns', () => {
  assert.equal(layersForTransmission(1.7, 0.04), 43);
  assert.equal(layersForTransmission(0.5, 0.04), 13);
  assert.equal(layersForTransmission(0.08, 0.04), 2);
  assert.equal(layersForTransmission(0.02, 0.04), 1);
  assert.equal(layersForTransmission(0, 0.04), 1);
});

test('layer 1 uses the base height and later layers use layer height', () => {
  const stack = planLayerSwaps([
    { name: 'Elegoo PLA Black', hex: '#161616', td: 9 },
    { name: 'GiantArm Silk Silver', hex: '#d5dce3', td: 1.7 },
    { name: 'Elegoo PLA Red', hex: 'd4252b', td: 0.08 },
  ], settings);

  assert.equal(stack[0].layerNumber, 1);
  assert.equal(stack[0].layerCount, 1);
  assert.equal(stack[0].zMm, 0);
  assert.equal(stack[0].zEndMm, 0.09);
  assert.equal(stack[0].hex, '#161616');

  assert.equal(stack[1].layerCount, 43);
  assert.equal(stack[1].layerNumber, 2);
  assert.equal(stack[1].zMm, 0.09);
  assert.equal(stack[1].zMm, layerStartZMm(2, settings));
  assert.equal(stack[1].zEndMm, 0.09 + 43 * 0.04);
  assert.equal(stack[1].zEndMm, layerTopZMm(44, settings));

  assert.equal(stack[2].layerNumber, 45);
  assert.equal(stack[2].layerCount, 2);
  assert.equal(stack[2].zMm, layerStartZMm(45, settings));
  assert.equal(stack[2].zMm, stack[1].zEndMm);
  assert.equal(stack[2].zEndMm, 1.89);
  assert.equal(stack[2].hex, '#D4252B');
});

test('rejects a non-positive layer height', () => {
  assert.throws(() => planLayerSwaps(
    [{ name: 'Black', hex: '#000000', td: 1 }],
    { layerHeight: 0, baseLayerHeight: 0.09 },
  ));
});

test('fitted size keeps the crop aspect inside the maximum bounds', () => {
  const wide = resolvePrintSize(293, 326, settings);
  assert.equal(wide.widthMm, 82.44);
  assert.equal(wide.heightMm, 91.725);
  nearly(wide.widthMm / wide.heightMm, 293 / 326, 1e-4);
  assert.equal(wide.insetMm, frameInsetMm(0.2, wide.heightMm));
  assert.equal(wide.insetMm, 1.6);
  assert.equal(wide.innerWidthMm, 79.24);
  assert.equal(wide.innerHeightMm, 88.525);
  assert.ok(wide.widthMm <= settings.width);
  assert.ok(wide.heightMm <= settings.height);

  const tall = resolvePrintSize(100, 400, settings);
  assert.equal(tall.heightMm, 105.45);
  assert.equal(tall.widthMm, 26.363);
  assert.ok(tall.widthMm <= settings.width);

  const matched = resolvePrintSize(8244, 10545, settings);
  assert.equal(matched.widthMm, 82.44);
  assert.equal(matched.heightMm, 105.45);
});

test('grid step is at least the nozzle and stays under the cell cap', () => {
  const grid = gridCells(79.24, 88.525, 0.2);
  assert.ok(grid.stepMm >= 0.2 - 1e-6);
  assert.ok(grid.cols <= 140);
  assert.ok(grid.rows <= 140);
  assert.equal(grid.rows, 140);

  const coarse = gridCells(2, 2, 0.2);
  assert.equal(coarse.cols, 10);
  assert.equal(coarse.rows, 10);
  assert.equal(coarse.stepMm, 0.2);
});

test('binary and ASCII STLs match the backing, relief, and frame dimensions', () => {
  const filaments = [
    { name: 'Elegoo PLA Black', hex: '#161616', td: 0.5 },
    { name: 'Elegoo PLA Dark Blue', hex: '#1A3E78', td: 0.04 },
    { name: 'Elegoo PLA Red', hex: '#D4252B', td: 0.08 },
  ];
  const built = buildHueforgeMeshes({
    cropWidthPx: 293,
    cropHeightPx: 326,
    luminance: new Float32Array([1, 1, 1, 1]),
    filaments,
    boundaries: [0.33, 0.66],
    settings,
    settingsSource: 'test',
    grid: { cols: 1, rows: 1 },
  });

  assert.equal(built.reliefPlaceholder, false);
  assert.equal(built.backing.length, 12);
  assert.equal(built.relief.length, 12);
  assert.equal(built.frame.length, 48);
  pointsOutward(built.backing);
  pointsOutward(built.relief);

  const backingBounds = triangleBounds(built.backing);
  nearly(backingBounds.min[0], 0);
  nearly(backingBounds.min[1], 0);
  nearly(backingBounds.min[2], 0);
  nearly(backingBounds.max[0], 82.44);
  nearly(backingBounds.max[1], 91.725);
  nearly(backingBounds.max[2], 0.09);

  const reliefBounds = triangleBounds(built.relief);
  nearly(reliefBounds.min[0], 1.6);
  nearly(reliefBounds.min[1], 1.6);
  nearly(reliefBounds.min[2], 0.09);
  nearly(reliefBounds.max[0], 1.6 + 79.24);
  nearly(reliefBounds.max[1], 1.6 + 88.525);
  nearly(reliefBounds.max[2], 0.21);

  const frameBounds = triangleBounds(built.frame);
  nearly(frameBounds.min[0], 0);
  nearly(frameBounds.min[1], 0);
  nearly(frameBounds.min[2], 0.09);
  nearly(frameBounds.max[0], 82.44);
  nearly(frameBounds.max[1], 91.725);
  nearly(frameBounds.max[2], 0.21);

  const opening = built.frame.filter((triangle) => triangle.verts.every((vertex) => (
    vertex[0] > built.size.insetMm + 1e-4
    && vertex[0] < built.size.widthMm - built.size.insetMm - 1e-4
    && vertex[1] > built.size.insetMm + 1e-4
    && vertex[1] < built.size.heightMm - built.size.insetMm - 1e-4
  )));
  assert.equal(opening.length, 0);

  const binary = encodeBinaryStl(built.backing, 'backing');
  assert.equal(binary.byteLength, 84 + built.backing.length * 50);
  const decoded = decodeBinaryStl(binary);
  assert.equal(decoded.length, 12);
  const decodedBounds = triangleBounds(decoded);
  nearly(decodedBounds.max[0], 82.44, 1e-3);
  nearly(decodedBounds.max[1], 91.725, 1e-3);
  nearly(decodedBounds.max[2], 0.09, 1e-4);

  const ascii = encodeAsciiStl(built.backing, 'backing');
  assert.match(ascii, /^solid backing\n/);
  assert.match(ascii, /endsolid backing\n$/);
  assert.equal(ascii.split('facet normal').length - 1, 12);
  const asciiVerts = [...ascii.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((match) => (
    [Number(match[1]), Number(match[2]), Number(match[3])]
  ));
  const asciiMaxZ = Math.max(...asciiVerts.map((vertex) => vertex[2]));
  const asciiMaxX = Math.max(...asciiVerts.map((vertex) => vertex[0]));
  nearly(asciiMaxX, 82.44, 1e-4);
  nearly(asciiMaxZ, 0.09, 1e-4);

  assert.match(built.details, /backing\.stl/);
  assert.match(built.details, /relief\.stl/);
  assert.match(built.details, /frame\.stl/);
  assert.match(built.details, /Layer 1 \| Z 0\.000 mm/);
  assert.match(built.details, /Elegoo PLA Black \| #161616/);
  assert.match(built.details, /outerWidth_mm: 82\.440/);
  assert.match(built.details, /outerHeight_mm: 91\.725/);
  assert.match(built.details, /baseLayerHeight_mm: 0\.090/);
  assert.match(built.details, /layerHeight_mm: 0\.040/);
  assert.match(built.details, /RELIEF_PLACEHOLDER: no/);
  assert.match(built.details, /source: test/);
});

test('the top of the image is placed at maximum Y', () => {
  const built = buildHueforgeMeshes({
    cropWidthPx: 293,
    cropHeightPx: 326,
    luminance: new Float32Array([1, 1, 0, 0]),
    filaments: [
      { name: 'Black', hex: '#111111', td: 1 },
      { name: 'White', hex: '#eeeeee', td: 0.04 },
    ],
    boundaries: [0.5],
    settings,
    grid: { cols: 1, rows: 1 },
  });
  const high = built.relief.flatMap((triangle) => triangle.verts)
    .filter((vertex) => Math.abs(vertex[1] - (built.size.insetMm + built.size.innerHeightMm)) < 1e-3);
  const low = built.relief.flatMap((triangle) => triangle.verts)
    .filter((vertex) => Math.abs(vertex[1] - built.size.insetMm) < 1e-3);
  const highZ = Math.max(...high.map((vertex) => vertex[2]));
  const lowZ = Math.max(...low.map((vertex) => vertex[2]));
  assert.ok(highZ > lowZ + 0.03, `expected the image top to be taller (${highZ} vs ${lowZ})`);
});

test('a flat backing image still writes a valid closed relief', () => {
  const built = buildHueforgeMeshes({
    cropWidthPx: 100,
    cropHeightPx: 100,
    luminance: new Float32Array([0, 0, 0, 0]),
    filaments: [
      { name: 'Black', hex: '#111111', td: 1 },
      { name: 'White', hex: '#eeeeee', td: 0.04 },
    ],
    boundaries: [0.5],
    settings,
    grid: { cols: 1, rows: 1 },
  });
  assert.equal(built.reliefPlaceholder, true);
  assert.match(built.details, /RELIEF_PLACEHOLDER: yes/);
  const binary = encodeBinaryStl(built.relief, 'relief');
  const decoded = decodeBinaryStl(binary);
  assert.equal(decoded.length, 12);
  const bounds = triangleBounds(decoded);
  nearly(bounds.max[2] - bounds.min[2], settings.layerHeight, 1e-4);
  assert.match(encodeAsciiStl(built.frame, 'frame'), /endsolid frame/);
});

test('two constant cells do not grow an internal wall', () => {
  const built = buildHueforgeMeshes({
    cropWidthPx: 293,
    cropHeightPx: 326,
    luminance: new Float32Array(6).fill(1),
    filaments: [
      { name: 'Black', hex: '#111111', td: 1 },
      { name: 'White', hex: '#eeeeee', td: 0.04 },
    ],
    boundaries: [0.5],
    settings,
    grid: { cols: 2, rows: 1 },
  });
  assert.equal(built.relief.length, 20);
});

test('a zip bundle round-trips the binary backing mesh', async () => {
  const built = buildHueforgeMeshes({
    cropWidthPx: 200,
    cropHeightPx: 200,
    luminance: new Float32Array([1, 1, 1, 1]),
    filaments: [
      { name: 'Black', hex: '#111111', td: 1 },
      { name: 'White', hex: '#eeeeee', td: 0.08 },
    ],
    boundaries: [0.5],
    settings,
    grid: { cols: 1, rows: 1 },
  });
  const zip = new JSZip();
  zip.file('backing.stl', encodeBinaryStl(built.backing, 'backing'));
  zip.file('relief.stl', encodeBinaryStl(built.relief, 'relief'));
  zip.file('frame.stl', encodeBinaryStl(built.frame, 'frame'));
  zip.file('details.txt', built.details);
  const names = Object.keys(zip.files).sort();
  assert.deepEqual(names, ['backing.stl', 'details.txt', 'frame.stl', 'relief.stl']);
  const backing = await zip.file('backing.stl')!.async('uint8array');
  assert.equal(decodeBinaryStl(backing).length, built.backing.length);
  const details = await zip.file('details.txt')!.async('string');
  assert.match(details, /nozzleSize_mm: 0\.200/);
});
