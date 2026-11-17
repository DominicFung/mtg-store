import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hexToRgb, type CoreStop } from './colourCore';
import {
  buildFaceMesh,
  decodeBinaryStl,
  LAUNCH_PROFILES,
  meshTriangleCount,
  profileToSettings,
  triangleBounds,
} from './printGeometry';

const meta = JSON.parse(readFileSync(new URL('./fixtures/eldrazi-case-1-right.json', import.meta.url), 'utf8')) as {
  width: number;
  height: number;
};
const rgba = new Uint8Array(readFileSync(new URL('./fixtures/eldrazi-case-1-right.rgba', import.meta.url)));

const profile = LAUNCH_PROFILES[1];
const settings = {
  ...profileToSettings(profile),
  height: 105.41,
};

const stops: CoreStop[] = [
  { filament: { type: 'PLA', brand: 'BambuLab Basic', name: 'Blue', td: 4 }, rgb: hexToRgb('#0022FF'), endLayer: 24 },
];

const SAMPLES: Array<[number, number, number]> = [
  [0, 0, 1.30043],
  [10, 10, 1.16229],
  [100, 200, 0.47624],
  [200, 100, 0.53523],
  [400, 400, 0.47893],
  [473, 526, 0.59854],
  [473, 0, 0.24],
  [0, 526, 1.76243],
  [237, 263, 0.71573],
];

function stlCandidates(): string[] {
  return [
    process.env.ELDRAZI_STL ?? '',
    '/tmp/eldrazi/eldrazi.stl',
    '/home/ubuntu/.cursor/projects/agent-repos-mtg-store/uploads/eldrazi.stl',
  ].filter(Boolean);
}

function heightGrid(bytes: Uint8Array, cols: number, rows: number, widthMm: number, heightMm: number): Float64Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const grid = new Float64Array((cols + 1) * (rows + 1));
  grid.fill(Number.NEGATIVE_INFINITY);
  for (let triangle = 0; triangle < count; triangle += 1) {
    const base = 84 + triangle * 50 + 12;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = base + vertex * 12;
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      const i = Math.round(((x + widthMm / 2) / widthMm) * cols);
      const j = Math.round(((y + heightMm / 2) / heightMm) * rows);
      const slot = j * (cols + 1) + i;
      if (i >= 0 && j >= 0 && i <= cols && j <= rows && z > grid[slot]) grid[slot] = z;
    }
  }
  return grid;
}

test('the Eldrazi 0.4 mm plate matches the colour-core lattice, lip, and brightness-adjusted depth', () => {
  assert.equal(meta.width, 376);
  assert.equal(meta.height, 418);
  assert.equal(rgba.byteLength, meta.width * meta.height * 4);
  const mesh = buildFaceMesh({
    rgba,
    imageWidth: meta.width,
    imageHeight: meta.height,
    settings,
    stops,
    header: 'colour-core',
    maxTriangles: 50_000_000,
  });
  assert.equal(mesh.cols, 474);
  assert.equal(mesh.rows, 527);
  nearly(mesh.widthMm, 94.8, 1e-9);
  nearly(mesh.heightMm, 105.4, 1e-9);
  assert.equal(mesh.triangles, meshTriangleCount(474, 527));
  assert.equal(mesh.triangles, 505602);
  assert.equal(mesh.layerCount, 25);
  nearly(mesh.actualDepthMm, 2.08);

  const decoded = decodeBinaryStl(mesh.stl);
  const bounds = triangleBounds(decoded);
  nearly(bounds.min[0], -47.4, 1e-3);
  nearly(bounds.max[0], 47.4, 1e-3);
  nearly(bounds.min[1], -52.7, 1e-3);
  nearly(bounds.max[1], 52.7, 1e-3);
  nearly(bounds.min[2], 0, 1e-4);
  nearly(bounds.max[2], 1.8224, 2e-3);

  const ours = heightGrid(mesh.stl, mesh.cols, mesh.rows, mesh.widthMm, mesh.heightMm);
  for (const [i, j, expected] of SAMPLES) {
    const actual = ours[j * (mesh.cols + 1) + i];
    assert.ok(
      Math.abs(actual - expected) <= 0.03,
      `height at ${i},${j} expected ${expected}, got ${actual}`,
    );
  }

  const referencePath = stlCandidates().find((path) => existsSync(path));
  if (!referencePath) return;
  const reference = heightGrid(new Uint8Array(readFileSync(referencePath)), mesh.cols, mesh.rows, mesh.widthMm, mesh.heightMm);
  let absolute = 0;
  let squared = 0;
  let worst = 0;
  const cells = mesh.cols * mesh.rows;
  for (let j = 0; j < mesh.rows; j += 1) {
    for (let i = 0; i < mesh.cols; i += 1) {
      const slot = j * (mesh.cols + 1) + i;
      const delta = Math.abs(ours[slot] - reference[slot]);
      absolute += delta;
      squared += delta * delta;
      if (delta > worst) worst = delta;
    }
  }
  const mae = absolute / cells;
  const rmse = Math.sqrt(squared / cells);
  assert.ok(mae < 0.012, `height MAE ${mae} mm`);
  assert.ok(rmse < 0.02, `height RMSE ${rmse} mm`);
  assert.ok(worst < 0.2, `worst height error ${worst} mm`);
  console.log(JSON.stringify({
    maeMm: round6(mae),
    rmseMm: round6(rmse),
    maxAbsMm: round6(worst),
    triangles: mesh.triangles,
    bounds: {
      min: bounds.min.map(round6),
      max: bounds.max.map(round6),
    },
    reference: referencePath,
  }));
});

function nearly(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
