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

const meta = JSON.parse(readFileSync(new URL('./fixtures/urza-case-3-left.json', import.meta.url), 'utf8')) as {
  width: number;
  height: number;
};
const rgba = new Uint8Array(readFileSync(new URL('./fixtures/urza-case-3-left.rgba', import.meta.url)));
const settings = {
  ...profileToSettings(LAUNCH_PROFILES[1]),
  height: 105.14,
  brightnessAdjust: 0,
  borderWidth: 0,
  borderDepth: 0,
  smoothing: 4,
};
const stops: CoreStop[] = [
  { filament: { type: 'PLA', brand: 'BambuLab Basic', name: 'White', td: 5 }, rgb: hexToRgb('#FFFFFF'), endLayer: 24 },
];

test('the Urza 0.4 mm plate matches the colour-core lattice with smoothing 4 and no border', () => {
  assert.equal(meta.width, 293);
  assert.equal(meta.height, 326);
  const mesh = buildFaceMesh({
    rgba,
    imageWidth: meta.width,
    imageHeight: meta.height,
    settings,
    stops,
    header: 'colour-core',
    maxTriangles: 50_000_000,
  });
  assert.equal(mesh.cols, 473);
  assert.equal(mesh.rows, 526);
  assert.equal(mesh.triangles, 503590);
  assert.equal(mesh.triangles, meshTriangleCount(473, 526));
  nearly(mesh.widthMm, 94.6, 1e-6);
  nearly(mesh.heightMm, 105.2, 1e-6);
  nearly(mesh.actualDepthMm, 2.08, 1e-6);
  const decoded = decodeBinaryStl(mesh.stl);
  const bounds = triangleBounds(decoded);
  nearly(bounds.min[2], 0, 1e-4);
  nearly(bounds.max[2], 2.08, 2e-3);
  assert.ok(bounds.max[2] < 2.2, 'border depth is not extruded');

  const referencePath = ['/tmp/urza/urza.stl', process.env.URZA_STL ?? ''].find((path) => path && existsSync(path));
  if (!referencePath) return;
  const mae = heightMae(mesh.stl, new Uint8Array(readFileSync(referencePath)), mesh.cols, mesh.rows, mesh.widthMm, mesh.heightMm);
  assert.ok(mae.mae < 0.015, `height MAE ${mae.mae}`);
  assert.ok(mae.rmse < 0.025, `height RMSE ${mae.rmse}`);
  console.log(JSON.stringify({ ...mae, triangles: mesh.triangles, maxZ: bounds.max[2] }));
});

function heightMae(ours: Uint8Array, reference: Uint8Array, cols: number, rows: number, widthMm: number, heightMm: number) {
  const left = grid(ours, cols, rows, widthMm, heightMm);
  const right = grid(reference, cols, rows, widthMm, heightMm);
  let absolute = 0;
  let squared = 0;
  let worst = 0;
  const cells = cols * rows;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const slot = j * (cols + 1) + i;
      const delta = Math.abs(left[slot] - right[slot]);
      absolute += delta;
      squared += delta * delta;
      if (delta > worst) worst = delta;
    }
  }
  return {
    mae: Math.round((absolute / cells) * 1e6) / 1e6,
    rmse: Math.round(Math.sqrt(squared / cells) * 1e6) / 1e6,
    maxAbs: Math.round(worst * 1e6) / 1e6,
  };
}

function grid(bytes: Uint8Array, cols: number, rows: number, widthMm: number, heightMm: number): Float64Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const values = new Float64Array((cols + 1) * (rows + 1));
  values.fill(Number.NEGATIVE_INFINITY);
  for (let triangle = 0; triangle < count; triangle += 1) {
    const base = 84 + triangle * 50 + 12;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = base + vertex * 12;
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      const i = Math.round(((x + widthMm / 2) / widthMm) * cols);
      const j = Math.round(((y + heightMm / 2) / heightMm) * rows);
      if (i < 0 || j < 0 || i > cols || j > rows) continue;
      const slot = j * (cols + 1) + i;
      if (z > values[slot]) values[slot] = z;
    }
  }
  return values;
}

function nearly(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}
