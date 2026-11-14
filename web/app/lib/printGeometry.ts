import {
  bilinear,
  colorCoreLayerCount,
  layerForLuminance,
  layerTopMm,
  luminanceFromRgba,
  minBlendLayer,
  mmToUm,
  smoothLuminance,
  smoothingRadiusPx,
  type CoreStop,
  type LayerSettings,
} from './hueforge';

/**
 * One HueForge colour-core solid per deck-box face.
 *
 * X is width, Y is face height, Z is up. The origin is the front-left corner
 * on the bed. The top of the artwork is at maximum Y. The outer footprint
 * follows the crop's pixel aspect at the shared face height. A border of
 * `borderWidth` sits inside that footprint and is raised to `borderDepth`.
 * The opening is a luminance heightmap: brighter pixels are taller, between
 * Min Depth and the top slider, snapped to layer tops.
 */

export type PrintSettings = LayerSettings & {
  /** Nominal back-face width, in millimetres. Each face's STL width follows its crop. */
  width: number;
  /** Shared face height, in millimetres. Width = height × crop aspect. */
  height: number;
  nozzleSize: number;
  borderWidth: number;
  borderDepth: number;
  detailSize: number;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  layerHeight: 0.04,
  baseLayerHeight: 0.09,
  width: 82.44,
  height: 105.45,
  nozzleSize: 0.2,
  minDepth: 0.25,
  maxDepth: 2.01,
  borderWidth: 4,
  borderDepth: 3,
  detailSize: 0.1,
};

export const PRINT_SETTINGS_ID = 'default';

/** Keeps a phone from allocating a multi-hundred-megabyte mesh. */
export const MAX_MESH_TRIANGLES = 180_000;

export const FACE_NAMES = ['front', 'spine', 'back'] as const;
export type FaceName = (typeof FACE_NAMES)[number];

export function umToMm(um: number): number {
  return um / 1000;
}

export function roundMm(mm: number): number {
  return Math.round(mm * 100) / 100;
}

/**
 * Model width follows the crop. 105.45 × 650/724 = 94.67 (right face) and
 * 105.45 × 480/614 = 82.44 (back face).
 */
export function modelSizeForCrop(
  cropWidthPx: number,
  cropHeightPx: number,
  faceHeightMm: number,
): { widthMm: number; heightMm: number } {
  const heightMm = roundMm(faceHeightMm);
  if (cropWidthPx <= 0 || cropHeightPx <= 0 || faceHeightMm <= 0) {
    return { widthMm: heightMm, heightMm };
  }
  return {
    widthMm: roundMm((faceHeightMm * cropWidthPx) / cropHeightPx),
    heightMm,
  };
}

export function meshTriangleCount(cols: number, rows: number): number {
  return 4 * cols * rows + 4 * (cols + rows);
}

export function meshGrid(
  widthMm: number,
  heightMm: number,
  detailMm: number,
  maxTriangles = MAX_MESH_TRIANGLES,
): { cols: number; rows: number; stepMm: number; triangles: number } {
  const detail = Math.min(Math.max(detailMm, 0.05), Math.max(widthMm, heightMm));
  let step = detail;
  let cols = Math.max(1, Math.round(widthMm / step));
  let rows = Math.max(1, Math.round(heightMm / step));
  let guard = 0;
  while (meshTriangleCount(cols, rows) > maxTriangles && guard < 48) {
    step *= 1.12;
    cols = Math.max(2, Math.round(widthMm / step));
    rows = Math.max(2, Math.round(heightMm / step));
    guard += 1;
  }
  return { cols, rows, stepMm: widthMm / cols, triangles: meshTriangleCount(cols, rows) };
}

export type Vec3 = [number, number, number];

export function triangleBoundsFromStl(bytes: Uint8Array): { min: Vec3; max: Vec3; count: number } {
  const triangles = decodeBinaryStl(bytes);
  return { ...triangleBounds(triangles), count: triangles.length };
}

export type Triangle = {
  normal: Vec3;
  verts: [Vec3, Vec3, Vec3];
};

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const n = cross(sub(b, a), sub(c, a));
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-12) return [0, 0, 1];
  return [n[0] / len, n[1] / len, n[2] / len];
}

export function encodeBinaryStl(triangles: readonly Triangle[], header = 'HueForge colour core'): Uint8Array {
  const bytes = new Uint8Array(84 + triangles.length * 50);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(header).subarray(0, 80), 0);
  view.setUint32(80, triangles.length, true);
  let offset = 84;
  for (const triangle of triangles) {
    const values = [...triangle.normal, ...triangle.verts[0], ...triangle.verts[1], ...triangle.verts[2]];
    for (const value of values) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return bytes;
}

export function decodeBinaryStl(bytes: Uint8Array): Triangle[] {
  if (bytes.byteLength < 84) throw new Error('STL is shorter than a binary header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  if (bytes.byteLength < 84 + count * 50) throw new Error('STL triangle count does not fit the file');
  const triangles: Triangle[] = [];
  let offset = 84;
  const readVec = (): Vec3 => {
    const vec: Vec3 = [
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    ];
    offset += 12;
    return vec;
  };
  for (let index = 0; index < count; index += 1) {
    const normal = readVec();
    const v1 = readVec();
    const v2 = readVec();
    const v3 = readVec();
    offset += 2;
    triangles.push({ normal, verts: [v1, v2, v3] });
  }
  return triangles;
}

export function triangleBounds(triangles: readonly Triangle[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (const vert of triangle.verts) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], vert[axis]);
        max[axis] = Math.max(max[axis], vert[axis]);
      }
    }
  }
  return { min, max };
}

export type HeightField = {
  cols: number;
  rows: number;
  widthMm: number;
  heightMm: number;
  /** Vertex Z, length (cols+1)*(rows+1). Row 0 is minimum Y. */
  heights: Float32Array;
  header?: string;
};

function writeNormal(view: DataView, offset: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) {
    nx = 0;
    ny = 0;
    nz = 1;
  } else {
    nx /= len;
    ny /= len;
    nz /= len;
  }
  view.setFloat32(offset, nx, true);
  view.setFloat32(offset + 4, ny, true);
  view.setFloat32(offset + 8, nz, true);
  view.setFloat32(offset + 12, ax, true);
  view.setFloat32(offset + 16, ay, true);
  view.setFloat32(offset + 20, az, true);
  view.setFloat32(offset + 24, bx, true);
  view.setFloat32(offset + 28, by, true);
  view.setFloat32(offset + 32, bz, true);
  view.setFloat32(offset + 36, cx, true);
  view.setFloat32(offset + 40, cy, true);
  view.setFloat32(offset + 44, cz, true);
  view.setUint16(offset + 48, 0, true);
  return offset + 50;
}

/** Binary STL of a solid heightfield. Top, bottom, and the four outer walls. */
export function encodeHeightfieldStl(field: HeightField): Uint8Array {
  const { cols, rows, widthMm, heightMm, heights } = field;
  const expected = (cols + 1) * (rows + 1);
  if (heights.length !== expected) {
    throw new Error(`Height field has ${heights.length} vertices, expected ${expected}`);
  }
  if (cols < 1 || rows < 1 || widthMm <= 0 || heightMm <= 0) {
    throw new Error('Height field must have a positive grid');
  }
  const count = meshTriangleCount(cols, rows);
  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(field.header ?? 'HueForge colour core').subarray(0, 80), 0);
  view.setUint32(80, count, true);
  let offset = 84;
  const xAt = (i: number) => (i / cols) * widthMm;
  const yAt = (j: number) => (j / rows) * heightMm;
  const zAt = (i: number, j: number) => heights[j * (cols + 1) + i];
  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ) => {
    offset = writeNormal(view, offset, ax, ay, az, bx, by, bz, cx, cy, cz);
  };
  const quad = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
  ) => {
    tri(ax, ay, az, bx, by, bz, cx, cy, cz);
    tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
  };

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      quad(
        xAt(i), yAt(j), zAt(i, j),
        xAt(i + 1), yAt(j), zAt(i + 1, j),
        xAt(i + 1), yAt(j + 1), zAt(i + 1, j + 1),
        xAt(i), yAt(j + 1), zAt(i, j + 1),
      );
      quad(
        xAt(i), yAt(j + 1), 0,
        xAt(i + 1), yAt(j + 1), 0,
        xAt(i + 1), yAt(j), 0,
        xAt(i), yAt(j), 0,
      );
    }
  }
  for (let j = 0; j < rows; j += 1) {
    quad(
      xAt(0), yAt(j + 1), 0,
      xAt(0), yAt(j), 0,
      xAt(0), yAt(j), zAt(0, j),
      xAt(0), yAt(j + 1), zAt(0, j + 1),
    );
    quad(
      xAt(cols), yAt(j), 0,
      xAt(cols), yAt(j + 1), 0,
      xAt(cols), yAt(j + 1), zAt(cols, j + 1),
      xAt(cols), yAt(j), zAt(cols, j),
    );
  }
  for (let i = 0; i < cols; i += 1) {
    quad(
      xAt(i + 1), yAt(0), 0,
      xAt(i + 1), yAt(0), zAt(i + 1, 0),
      xAt(i), yAt(0), zAt(i, 0),
      xAt(i), yAt(0), 0,
    );
    quad(
      xAt(i), yAt(rows), 0,
      xAt(i), yAt(rows), zAt(i, rows),
      xAt(i + 1), yAt(rows), zAt(i + 1, rows),
      xAt(i + 1), yAt(rows), 0,
    );
  }
  return bytes;
}

export function buildVertexHeights(input: {
  widthMm: number;
  heightMm: number;
  cols: number;
  rows: number;
  borderWidthMm: number;
  borderDepthMm: number;
  /** Row 0 is the top of the image. */
  luma: Float32Array;
  lumaCols: number;
  lumaRows: number;
  settings: LayerSettings;
  maxLayer: number;
}): Float32Array {
  const { cols, rows, widthMm, heightMm, settings } = input;
  const heights = new Float32Array((cols + 1) * (rows + 1));
  const border = Math.max(0, input.borderWidthMm);
  const innerW = widthMm - 2 * border;
  const innerH = heightMm - 2 * border;
  const minLayer = Math.min(minBlendLayer(settings), input.maxLayer);
  const maxLayer = Math.max(minLayer, input.maxLayer);
  for (let j = 0; j <= rows; j += 1) {
    const y = (j / rows) * heightMm;
    for (let i = 0; i <= cols; i += 1) {
      const x = (i / cols) * widthMm;
      const onBorder = border > 0 && (innerW <= 0 || innerH <= 0
        || x <= border || y <= border || x >= widthMm - border || y >= heightMm - border);
      let z = input.borderDepthMm;
      if (!onBorder) {
        const u = border > 0 ? (x - border) / innerW : x / widthMm;
        const v = border > 0 ? (y - border) / innerH : y / heightMm;
        const sample = bilinear(input.luma, input.lumaCols, input.lumaRows, u, 1 - v);
        z = layerTopMm(layerForLuminance(sample, minLayer, maxLayer), settings);
      }
      heights[j * (cols + 1) + i] = z;
    }
  }
  return heights;
}

export type FaceMesh = {
  widthMm: number;
  heightMm: number;
  cols: number;
  rows: number;
  stepMm: number;
  triangles: number;
  stl: Uint8Array;
  actualDepthMm: number;
  layerCount: number;
};

export function buildFaceMesh(input: {
  rgba: Uint8ClampedArray | Uint8Array;
  /** Pixel size of `rgba`. */
  imageWidth: number;
  imageHeight: number;
  /** Crop pixel size used for the plate aspect. Defaults to the raster size. */
  cropWidthPx?: number;
  cropHeightPx?: number;
  settings: PrintSettings;
  stops: readonly CoreStop[];
  smoothing?: number;
  maxTriangles?: number;
  header?: string;
}): FaceMesh {
  if (input.stops.length === 0) throw new Error('Choose at least one filament');
  const size = modelSizeForCrop(
    input.cropWidthPx ?? input.imageWidth,
    input.cropHeightPx ?? input.imageHeight,
    input.settings.height,
  );
  const grid = meshGrid(size.widthMm, size.heightMm, input.settings.detailSize, input.maxTriangles);
  const raw = luminanceFromRgba(input.rgba, input.imageWidth, input.imageHeight);
  const radius = smoothingRadiusPx(
    input.imageWidth,
    size.widthMm,
    input.settings.detailSize,
    input.smoothing,
  );
  const luma = smoothLuminance(raw, input.imageWidth, input.imageHeight, radius);
  const layerCount = colorCoreLayerCount(input.settings);
  const maxLayer = Math.min(layerCount, input.stops[input.stops.length - 1].endLayer);
  const heights = buildVertexHeights({
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    cols: grid.cols,
    rows: grid.rows,
    borderWidthMm: input.settings.borderWidth,
    borderDepthMm: input.settings.borderDepth,
    luma,
    lumaCols: input.imageWidth,
    lumaRows: input.imageHeight,
    settings: input.settings,
    maxLayer,
  });
  const stl = encodeHeightfieldStl({
    cols: grid.cols,
    rows: grid.rows,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    heights,
    header: input.header,
  });
  return {
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    cols: grid.cols,
    rows: grid.rows,
    stepMm: grid.stepMm,
    triangles: grid.triangles,
    stl,
    actualDepthMm: layerTopMm(maxLayer, input.settings),
    layerCount,
  };
}

export function heightRange(heights: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < heights.length; index += 1) {
    const value = heights[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

export { mmToUm };
