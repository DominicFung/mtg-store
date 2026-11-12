import { bandIndex, equalBoundaries } from './hueforge';

/**
 * HueForge-style meshes for one deck-box face.
 *
 * The three STLs share a millimetre, Z-up frame. X is the face width, Y is the
 * face height, and the origin is the front-left corner of the backing on the bed.
 * Layer 1 is `baseLayerHeight` thick. Every later layer is `layerHeight` thick.
 *
 * backing.stl  — solid slab of the opaque first filament, Z 0 .. baseLayerHeight.
 * relief.stl   — heightmap of the front (left) crop, sitting on the backing.
 * frame.stl    — border ring around that relief, also sitting on the backing.
 */

export type PrintSettings = {
  layerHeight: number;
  baseLayerHeight: number;
  /** Maximum printable width, in millimetres. */
  width: number;
  /** Maximum printable height, in millimetres. */
  height: number;
  nozzleSize: number;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  layerHeight: 0.04,
  baseLayerHeight: 0.09,
  width: 82.44,
  height: 105.45,
  nozzleSize: 0.2,
};

export const PRINT_SETTINGS_ID = 'default';

/** Longest relief edge, in cells. Keeps a phone from building a multi-megabyte mesh. */
export const MAX_GRID_CELLS = 140;

const UM = 1000;

export function mmToUm(mm: number): number {
  return Math.round(mm * UM);
}

export function umToMm(um: number): number {
  return um / UM;
}

export function formatMm(mm: number): string {
  return (mmToUm(mm) / UM).toFixed(3);
}

export type SwapFilament = {
  name: string;
  hex: string;
  td: number;
};

export type LayerSwap = {
  /** 1-based slicer layer where this filament starts. */
  layerNumber: number;
  /** Z of the bottom of that layer, in mm. */
  zMm: number;
  /** Z of the top of this filament's last layer, in mm. */
  zEndMm: number;
  layerCount: number;
  name: string;
  hex: string;
  td: number;
};

export function normalizeHex(hex: string): string {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((channel) => channel + channel).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#808080';
  return `#${full.toUpperCase()}`;
}

/**
 * How many `layerHeight` slices a transmission distance occupies.
 * Rounded in microns so values like 1.7 / 0.04 do not drift to 42.
 */
export function layersForTransmission(tdMm: number, layerHeightMm: number): number {
  const layerUm = mmToUm(layerHeightMm);
  if (layerUm <= 0) return 1;
  const tdUm = Math.max(0, mmToUm(tdMm));
  return Math.max(1, Math.round(tdUm / layerUm));
}

/** Z at the bottom of a 1-based layer. Layer 1 starts at 0. */
export function layerStartZMm(
  layerNumber: number,
  settings: Pick<PrintSettings, 'baseLayerHeight' | 'layerHeight'>,
): number {
  if (layerNumber <= 1) return 0;
  const baseUm = mmToUm(settings.baseLayerHeight);
  const layerUm = mmToUm(settings.layerHeight);
  return umToMm(baseUm + (layerNumber - 2) * layerUm);
}

/** Z at the top of a 1-based layer. Layer 1 ends at baseLayerHeight. */
export function layerTopZMm(
  layerNumber: number,
  settings: Pick<PrintSettings, 'baseLayerHeight' | 'layerHeight'>,
): number {
  if (layerNumber < 1) return 0;
  const baseUm = mmToUm(settings.baseLayerHeight);
  const layerUm = mmToUm(settings.layerHeight);
  return umToMm(baseUm + (layerNumber - 1) * layerUm);
}

/**
 * Filament change list, bottom (printed first) to top.
 * The first filament is one base layer, whatever its transmission distance is.
 * Each later filament occupies round(td / layerHeight) layers, at least one.
 */
export function planLayerSwaps(
  filaments: readonly SwapFilament[],
  settings: Pick<PrintSettings, 'layerHeight' | 'baseLayerHeight'>,
): LayerSwap[] {
  if (mmToUm(settings.baseLayerHeight) <= 0 || mmToUm(settings.layerHeight) <= 0) {
    throw new Error('Layer heights must be positive');
  }
  let layerNumber = 1;
  return filaments.map((filament, index) => {
    const layerCount = index === 0 ? 1 : layersForTransmission(filament.td, settings.layerHeight);
    const endLayer = layerNumber + layerCount - 1;
    const swap: LayerSwap = {
      layerNumber,
      zMm: layerStartZMm(layerNumber, settings),
      zEndMm: layerTopZMm(endLayer, settings),
      layerCount,
      name: filament.name,
      hex: normalizeHex(filament.hex),
      td: filament.td,
    };
    layerNumber = endLayer + 1;
    return swap;
  });
}

/** Extra millimetres above the backing for a luminance band. Band 0 is backing only. */
export function extraHeightMm(band: number, swaps: readonly LayerSwap[]): number {
  if (swaps.length === 0) return 0;
  const index = Math.max(0, Math.min(band, swaps.length - 1));
  return umToMm(mmToUm(swaps[index].zEndMm) - mmToUm(swaps[0].zEndMm));
}

export type ResolvedPrintSize = {
  widthMm: number;
  heightMm: number;
  insetMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
};

/**
 * Frame width: 8 nozzles, at least 1.6 mm, and at most 15% of the short side.
 */
export function frameInsetMm(nozzleSize: number, shortSideMm: number): number {
  const desired = Math.max(mmToUm(nozzleSize) * 8, mmToUm(1.6));
  const cap = Math.max(mmToUm(nozzleSize), Math.floor(mmToUm(shortSideMm) * 0.15));
  return umToMm(Math.min(desired, cap));
}

export function fitInside(aspect: number, maxWidth: number, maxHeight: number): { widthMm: number; heightMm: number } {
  if (!Number.isFinite(aspect) || aspect <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { widthMm: umToMm(mmToUm(maxWidth)), heightMm: umToMm(mmToUm(maxHeight)) };
  }
  if (aspect >= maxWidth / maxHeight) {
    return { widthMm: umToMm(mmToUm(maxWidth)), heightMm: umToMm(mmToUm(maxWidth / aspect)) };
  }
  return { widthMm: umToMm(mmToUm(maxHeight * aspect)), heightMm: umToMm(mmToUm(maxHeight)) };
}

/**
 * Outer footprint keeps the crop's pixel aspect ratio and fits inside the
 * configured maximum. The frame is inset inside that footprint.
 */
export function resolvePrintSize(
  cropWidthPx: number,
  cropHeightPx: number,
  settings: PrintSettings,
): ResolvedPrintSize {
  const outer = fitInside(cropWidthPx / cropHeightPx, settings.width, settings.height);
  const short = Math.min(outer.widthMm, outer.heightMm);
  let insetUm = mmToUm(frameInsetMm(settings.nozzleSize, short));
  const opening = Math.min(mmToUm(outer.widthMm), mmToUm(outer.heightMm));
  if (opening - 2 * insetUm < mmToUm(1)) {
    insetUm = Math.max(mmToUm(settings.nozzleSize), Math.floor(opening / 10));
  }
  return {
    widthMm: outer.widthMm,
    heightMm: outer.heightMm,
    insetMm: umToMm(insetUm),
    innerWidthMm: umToMm(mmToUm(outer.widthMm) - 2 * insetUm),
    innerHeightMm: umToMm(mmToUm(outer.heightMm) - 2 * insetUm),
  };
}

export function gridCells(
  widthMm: number,
  heightMm: number,
  nozzleSize: number,
  maxCells = MAX_GRID_CELLS,
): { cols: number; rows: number; stepMm: number } {
  const longUm = Math.max(1, mmToUm(Math.max(widthMm, heightMm)));
  const nozzleUm = Math.max(1, mmToUm(nozzleSize));
  const stepUm = Math.max(nozzleUm, Math.ceil(longUm / Math.max(1, maxCells)));
  const cols = Math.max(1, Math.round(mmToUm(widthMm) / stepUm));
  const rows = Math.max(1, Math.round(mmToUm(heightMm) / stepUm));
  return { cols, rows, stepMm: umToMm(stepUm) };
}

export type Vec3 = [number, number, number];

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

function pushTri(out: Triangle[], a: Vec3, b: Vec3, c: Vec3) {
  const area = Math.hypot(...cross(sub(b, a), sub(c, a)));
  if (area < 1e-8) return;
  out.push({ normal: faceNormal(a, b, c), verts: [a, b, c] });
}

function pushQuad(out: Triangle[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
  pushTri(out, a, b, c);
  pushTri(out, a, c, d);
}

export function boxTriangles(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): Triangle[] {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const out: Triangle[] = [];
  pushQuad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(out, [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]);
  pushQuad(out, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
  pushQuad(out, [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y0, z0]);
  pushQuad(out, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  pushQuad(out, [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]);
  return out;
}

export type HeightField = {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  widthMm: number;
  heightMm: number;
  zBottomMm: number;
  /** Mesh-order vertex extras, length (cols+1)*(rows+1). Row 0 is minimum Y. */
  extraMm: ArrayLike<number>;
};

export function heightmapTriangles(field: HeightField): Triangle[] {
  const { cols, rows } = field;
  const expected = (cols + 1) * (rows + 1);
  if (field.extraMm.length !== expected) {
    throw new Error(`Height field has ${field.extraMm.length} vertices, expected ${expected}`);
  }
  const cellW = field.widthMm / cols;
  const cellH = field.heightMm / rows;
  const z0 = field.zBottomMm;
  const eps = 0.0005;
  const extraAt = (i: number, j: number) => field.extraMm[j * (cols + 1) + i];
  const included = (i: number, j: number) => (
    extraAt(i, j) > eps
    || extraAt(i + 1, j) > eps
    || extraAt(i + 1, j + 1) > eps
    || extraAt(i, j + 1) > eps
  );
  const top = (i: number, j: number): Vec3 => [
    field.originX + i * cellW,
    field.originY + j * cellH,
    z0 + Math.max(0, extraAt(i, j)),
  ];
  const bot = (i: number, j: number): Vec3 => [
    field.originX + i * cellW,
    field.originY + j * cellH,
    z0,
  ];
  const out: Triangle[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!included(i, j)) continue;
      pushQuad(out, top(i, j), top(i + 1, j), top(i + 1, j + 1), top(i, j + 1));
      pushQuad(out, bot(i, j), bot(i, j + 1), bot(i + 1, j + 1), bot(i + 1, j));
      if (j === 0 || !included(i, j - 1)) {
        pushQuad(out, bot(i, j), bot(i + 1, j), top(i + 1, j), top(i, j));
      }
      if (j === rows - 1 || !included(i, j + 1)) {
        pushQuad(out, bot(i + 1, j + 1), bot(i, j + 1), top(i, j + 1), top(i + 1, j + 1));
      }
      if (i === 0 || !included(i - 1, j)) {
        pushQuad(out, bot(i, j + 1), bot(i, j), top(i, j), top(i, j + 1));
      }
      if (i === cols - 1 || !included(i + 1, j)) {
        pushQuad(out, bot(i + 1, j), bot(i + 1, j + 1), top(i + 1, j + 1), top(i + 1, j));
      }
    }
  }
  return out;
}

export function frameTriangles(size: ResolvedPrintSize, z0: number, z1: number): Triangle[] {
  const { widthMm: width, heightMm: height, insetMm: inset } = size;
  return [
    ...boxTriangles(0, 0, z0, width, inset, z1),
    ...boxTriangles(0, height - inset, z0, width, height, z1),
    ...boxTriangles(0, inset, z0, inset, height - inset, z1),
    ...boxTriangles(width - inset, inset, z0, width, height - inset, z1),
  ];
}

export function encodeBinaryStl(triangles: readonly Triangle[], header = 'Mana Ramp deck box'): Uint8Array {
  const bytes = new Uint8Array(84 + triangles.length * 50);
  const view = new DataView(bytes.buffer);
  const headerBytes = new TextEncoder().encode(header).subarray(0, 80);
  bytes.set(headerBytes, 0);
  view.setUint32(80, triangles.length, true);
  let offset = 84;
  for (const triangle of triangles) {
    const values = [
      ...triangle.normal,
      ...triangle.verts[0],
      ...triangle.verts[1],
      ...triangle.verts[2],
    ];
    for (const value of values) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return bytes;
}

function formatComponent(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 1e6) / 1e6);
}

export function encodeAsciiStl(triangles: readonly Triangle[], name = 'mesh'): string {
  const lines = [`solid ${name}`];
  for (const triangle of triangles) {
    const [nx, ny, nz] = triangle.normal;
    lines.push(`  facet normal ${formatComponent(nx)} ${formatComponent(ny)} ${formatComponent(nz)}`);
    lines.push('    outer loop');
    for (const vert of triangle.verts) {
      lines.push(`      vertex ${formatComponent(vert[0])} ${formatComponent(vert[1])} ${formatComponent(vert[2])}`);
    }
    lines.push('    endloop');
    lines.push('  endfacet');
  }
  lines.push(`endsolid ${name}`);
  return `${lines.join('\n')}\n`;
}

export function decodeBinaryStl(bytes: Uint8Array): Triangle[] {
  if (bytes.byteLength < 84) throw new Error('STL is shorter than a binary header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const expected = 84 + count * 50;
  if (bytes.byteLength < expected) throw new Error('STL triangle count does not fit the file');
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

export type MeshBuildInput = {
  cropWidthPx: number;
  cropHeightPx: number;
  /**
   * Stretched luminance, 0..1, row-major, image order (row 0 is the top).
   * Length must be (cols+1)*(rows+1).
   */
  luminance: ArrayLike<number>;
  filaments: readonly SwapFilament[];
  boundaries: readonly number[];
  settings: PrintSettings;
  settingsSource?: string;
  grid?: { cols: number; rows: number };
};

export type BuiltMeshes = {
  size: ResolvedPrintSize;
  swaps: LayerSwap[];
  backing: Triangle[];
  relief: Triangle[];
  frame: Triangle[];
  reliefPlaceholder: boolean;
  grid: { cols: number; rows: number; stepMm: number };
  details: string;
};

export const MESHED_FACE = 'front (left crop; the preview maps this panel to Face3)';

export function buildHueforgeMeshes(input: MeshBuildInput): BuiltMeshes {
  if (input.filaments.length === 0) throw new Error('Choose at least one filament');
  const size = resolvePrintSize(input.cropWidthPx, input.cropHeightPx, input.settings);
  const swaps = planLayerSwaps(input.filaments, input.settings);
  const boundaries: number[] = input.boundaries.length === input.filaments.length - 1
    ? [...input.boundaries]
    : equalBoundaries(input.filaments.length);
  const grid = input.grid
    ? {
      cols: input.grid.cols,
      rows: input.grid.rows,
      stepMm: input.grid.cols > 0 ? umToMm(Math.round(mmToUm(size.innerWidthMm) / input.grid.cols)) : size.innerWidthMm,
    }
    : gridCells(size.innerWidthMm, size.innerHeightMm, input.settings.nozzleSize);
  if (grid.cols < 1 || grid.rows < 1) throw new Error('Print grid must have at least one cell');
  const vertices = (grid.cols + 1) * (grid.rows + 1);
  if (input.luminance.length !== vertices) {
    throw new Error(`Expected ${vertices} luminance samples for a ${grid.cols}x${grid.rows} grid`);
  }

  const extra = new Float32Array(vertices);
  let maxExtraUm = 0;
  for (let j = 0; j <= grid.rows; j += 1) {
    const imageRow = grid.rows - j;
    for (let i = 0; i <= grid.cols; i += 1) {
      const sample = input.luminance[imageRow * (grid.cols + 1) + i];
      const band = bandIndex(typeof sample === 'number' ? sample : 0, boundaries);
      const extraUm = mmToUm(extraHeightMm(Math.min(band, swaps.length - 1), swaps));
      extra[j * (grid.cols + 1) + i] = extraUm / UM;
      if (extraUm > maxExtraUm) maxExtraUm = extraUm;
    }
  }

  const zBottom = swaps[0].zEndMm;
  const backing = boxTriangles(0, 0, 0, size.widthMm, size.heightMm, zBottom);
  let relief = heightmapTriangles({
    cols: grid.cols,
    rows: grid.rows,
    originX: size.insetMm,
    originY: size.insetMm,
    widthMm: size.innerWidthMm,
    heightMm: size.innerHeightMm,
    zBottomMm: zBottom,
    extraMm: extra,
  });
  const reliefPlaceholder = relief.length === 0;
  const topUm = mmToUm(zBottom) + (maxExtraUm > 0 ? maxExtraUm : mmToUm(input.settings.layerHeight));
  const zTop = umToMm(topUm);
  if (reliefPlaceholder) {
    relief = boxTriangles(
      size.insetMm,
      size.insetMm,
      zBottom,
      size.insetMm + size.innerWidthMm,
      size.insetMm + size.innerHeightMm,
      zTop,
    );
  }
  const frame = frameTriangles(size, zBottom, zTop);
  const details = formatDetails({
    input,
    size,
    swaps,
    grid,
    boundaries,
    reliefPlaceholder,
    triangleCounts: {
      backing: backing.length,
      relief: relief.length,
      frame: frame.length,
    },
    zTop,
  });
  return { size, swaps, backing, relief, frame, reliefPlaceholder, grid, details };
}

function formatDetails(report: {
  input: MeshBuildInput;
  size: ResolvedPrintSize;
  swaps: LayerSwap[];
  grid: { cols: number; rows: number; stepMm: number };
  boundaries: readonly number[];
  reliefPlaceholder: boolean;
  triangleCounts: { backing: number; relief: number; frame: number };
  zTop: number;
}): string {
  const { input, size, swaps, grid } = report;
  const lines = [
    'Mana Ramp deck box — HueForge filament swap',
    'Units: millimetres. X is width, Y is face height, Z is up.',
    'Origin: front-left corner of the backing, on the printer bed.',
    'The top of the artwork is at maximum Y.',
    '',
    'WHAT EACH STL IS',
    'backing.stl',
    '  Solid slab of the opaque first filament. Full outer footprint.',
    '  It is only the first printed layer (the base layer height), from Z 0 to the base height.',
    'relief.stl',
    `  Heightmap of the ${MESHED_FACE}.`,
    '  Each vertex is the extra thickness, above the backing, of the filaments selected by that pixel\'s luminance band.',
    '  Its lowest Z is the top of the backing. It does not include the frame border.',
    'frame.stl',
    '  Border ring around the relief. Same outer footprint as the backing.',
    '  It starts at the top of the backing and rises to the tallest point of the relief.',
    '  The four bars meet at the corners and do not overlap each other, the backing, or the relief.',
    '  Printed with the same layer swaps, so the top of the ring is the last filament.',
    '',
    'HOW TO IMPORT',
    'The three files already share one coordinate system.',
    'Add them as parts of a single object so the slicer keeps that alignment',
    '(PrusaSlicer, OrcaSlicer, or Bambu Studio: merge into one object).',
    'Do not drop each file onto the bed separately. The relief and the frame are already raised by the backing thickness.',
    '',
    'LAYER HEIGHTS',
    'The first printed layer uses baseLayerHeight. Every layer after that uses layerHeight.',
    'Z at the start of layer 1 = 0.',
    'Z at the start of layer n (n >= 2) = baseLayerHeight + (n - 2) * layerHeight.',
    'Z at the top of layer n = baseLayerHeight + (n - 1) * layerHeight.',
    '',
    'ASSUMPTIONS',
    '- The mesh is the front (left) panel only. The spine and the back are the PNG crops in this zip, not STLs.',
    '- The backing filament is a single base layer. Its transmission distance is not used as thickness, because the preview treats that filament as opaque.',
    '- Each later filament is max(1, round(td / layerHeight)) layers thick. td is the catalogue transmission distance and may still be an approximate placeholder. Measuring a spool changes these layer numbers.',
    '- Luminance is stretched the same way as the on-screen preview, then split on the boundaries you set. A boundary value stays with the lower filament.',
    '- width and height in print settings are maximum bounds. The outer footprint keeps the front crop\'s pixel aspect ratio and is fitted inside those bounds.',
    '- A uniform frame inset sits inside that footprint, so the opening is a fraction of a percent away from the crop aspect.',
    `- The frame is 8 nozzles wide (at least 1.6 mm, at most 15% of the short side). This export uses ${formatMm(size.insetMm)} mm.`,
    '- The relief grid is no finer than the nozzle and no denser than 140 cells on the long side.',
    '- Generated in the browser from the crop the customer made. No server mesh.',
    report.reliefPlaceholder
      ? '- RELIEF_PLACEHOLDER: yes. Every pixel stayed in the backing band, so relief.stl and frame.stl are closed one-layer solids of the same first filament. They are not a second colour.'
      : '- RELIEF_PLACEHOLDER: no.',
    '',
    'PRINT SETTINGS USED',
    `source: ${input.settingsSource ?? 'unspecified'}`,
    `layerHeight_mm: ${formatMm(input.settings.layerHeight)}`,
    `baseLayerHeight_mm: ${formatMm(input.settings.baseLayerHeight)}`,
    `maxWidth_mm: ${formatMm(input.settings.width)}`,
    `maxHeight_mm: ${formatMm(input.settings.height)}`,
    `nozzleSize_mm: ${formatMm(input.settings.nozzleSize)}`,
    `frontCrop_px: ${input.cropWidthPx} x ${input.cropHeightPx}`,
    `outerWidth_mm: ${formatMm(size.widthMm)}`,
    `outerHeight_mm: ${formatMm(size.heightMm)}`,
    `reliefWidth_mm: ${formatMm(size.innerWidthMm)}`,
    `reliefHeight_mm: ${formatMm(size.innerHeightMm)}`,
    `frameInset_mm: ${formatMm(size.insetMm)}`,
    `reliefTop_mm: ${formatMm(report.zTop)}`,
    `grid: ${grid.cols} x ${grid.rows}`,
    `gridStep_mm: ${formatMm(grid.stepMm)}`,
    `luminanceBoundaries: ${report.boundaries.map((value) => value.toFixed(4)).join(', ') || '(none)'}`,
    `triangles: backing ${report.triangleCounts.backing}, relief ${report.triangleCounts.relief}, frame ${report.triangleCounts.frame}`,
    '',
    'FILAMENT SWAPS',
    'Change filament at the start of the layer, before that layer prints.',
    'Order is the print order, first layer at the bottom.',
    ...swaps.map((swap) => (
      `Layer ${swap.layerNumber} | Z ${formatMm(swap.zMm)} mm | through Z ${formatMm(swap.zEndMm)} mm | ${swap.layerCount} ${swap.layerCount === 1 ? 'layer' : 'layers'} | ${swap.name} | ${swap.hex} | td ${formatMm(swap.td)} mm`
    )),
    '',
    'IMAGES IN THIS ZIP',
    'crop-1.png, crop-2.png, crop-3.png — the three faces, left to right, before filament colours.',
    'layered-1.png, layered-2.png, layered-3.png — the same faces as shown in the preview.',
    'The meshes are built from the left face (crop-1) only.',
    'filament-layers.json — the stack, the boundaries, and these swap points.',
    '',
  ];
  return lines.join('\n');
}
