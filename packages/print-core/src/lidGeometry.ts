/// <reference path="./modules.d.ts" />
import earcut from 'earcut';
import opentype from 'opentype.js';
import { cleanLidText, LID_FONT_FILE, LID_TEXT_MAX, normalizeLidText } from './lidText';
import { faceNormal, triangleBounds, type Triangle, type Vec3 } from './printGeometry';

export { cleanLidText, LID_FONT_FILE, LID_TEXT_MAX, normalizeLidText };

/**
 * Lid.stl sits in the deck box opening. Coordinates are millimetres, Z up,
 * origin at the lid's minimum corner. The source file has the finger notch
 * at Y = 0 and the planeswalker spark toward +Y. The spine art plate is on
 * the box's Y = 0 end. The lid is turned 180° about Z before it is placed,
 * so the logo and the name stay on the top face, the name stays readable,
 * and the notch end is the far end. The lid then slides out along +Y, away
 * from the spine plate.
 *
 * Measured from Lid.stl and edh_box.stl. The plate top is flush with the
 * box rim when the lid rests on the rail (about 98.03 mm). Side walls are
 * about 3 mm, so the lid is centred in X. A closed lid starts at the box's
 * Y = 0 and still fills the same footprint after the half turn.
 */

export const PLATE_TOP_MM = 7.39;
export const EMBOSS_MM = 1.01;
export const SPARK_SPLIT_Z = 7.5;
export const LID_OPEN_TRAVEL_MM = 72;

/**
 * The seated lid is not flush with the travel's zero. A tenth of the slide
 * is as far back as the lid can sit. Anything further into the box is past
 * the rail, so the slider, the drag, and the preview all stop here.
 */
export const LID_CLOSED_FRACTION = 0.1;
export const LID_SEATED_OFFSET_MM = LID_CLOSED_FRACTION * LID_OPEN_TRAVEL_MM;

export const LID_SIZE = {
  width: 76.67999267578125,
  depth: 88.1259765625,
  height: 8.397614479064941,
};

export const BOX_SIZE = {
  width: 82.55200958251953,
  depth: 94.47998809814453,
  height: 105.41000366210938,
};

/** Closed lid origin, in the box STL frame. */
export const LID_CLOSED_IN_BOX = {
  x: (BOX_SIZE.width - LID_SIZE.width) / 2,
  y: 0,
  z: 98.032,
};

/**
 * edh_box_v1.glb is the same shell with Y up. Scene X is STL X,
 * scene Y is STL Z, scene Z is STL Y.
 */
export const STL_TO_GLB = {
  x: -42.45330810546875,
  yFromZ: -60.93869400024414,
  zFromY: -58.60725021362305,
};

const TEXT_CENTER_X = LID_SIZE.width / 2;
/** In the source lid, before the half turn. Closer to the spark than the old 17.5 mm band. */
const TEXT_CENTER_Y = 23;
const TEXT_MAX_WIDTH = 58;
const TEXT_MAX_HEIGHT = 9;

type XY = [number, number];

export function stlBoxPointToGlb(x: number, y: number, z: number): Vec3 {
  return [x + STL_TO_GLB.x, z + STL_TO_GLB.yFromZ, y + STL_TO_GLB.zFromY];
}

/** Lid-local point at the closed position, in the preview's Y-up frame. */
export function lidLocalToGlb(x: number, y: number, z: number): Vec3 {
  return stlBoxPointToGlb(
    x + LID_CLOSED_IN_BOX.x,
    y + LID_CLOSED_IN_BOX.y,
    z + LID_CLOSED_IN_BOX.z,
  );
}

/** Slider position. 0 is seated, 1 is fully open. Values outside that stay on the ends. */
export function clampLidOpen(open: number): number {
  if (!Number.isFinite(open)) return 0;
  return Math.min(1, Math.max(0, open));
}

/**
 * Millimetres out from the old flush pose, toward the card window (positive
 * scene Z). The seated offset is the minimum: a negative or undershot value
 * is pulled back up to the rail.
 */
export function clampLidOffset(offsetMm: number): number {
  if (!Number.isFinite(offsetMm)) return LID_SEATED_OFFSET_MM;
  return Math.min(LID_OPEN_TRAVEL_MM, Math.max(LID_SEATED_OFFSET_MM, offsetMm));
}

/**
 * Slide out away from the spine plate (box Y = 0, scene −Z) and toward the
 * opposite end. 0 is the seated closed pose, 1 is fully open. Positive scene Z.
 * The result is never less than the seated offset.
 */
export function lidSlideOffset(open: number): number {
  const t = clampLidOpen(open);
  return clampLidOffset(LID_SEATED_OFFSET_MM + t * (LID_OPEN_TRAVEL_MM - LID_SEATED_OFFSET_MM));
}

/** Half turn about vertical. The top face stays up and the design stays readable. */
export function turnLidAround(triangles: readonly Triangle[]): Triangle[] {
  return triangles.map((triangle) => {
    const verts = triangle.verts.map((vert): Vec3 => [
      LID_SIZE.width - vert[0],
      LID_SIZE.depth - vert[1],
      vert[2],
    ]) as [Vec3, Vec3, Vec3];
    return { normal: faceNormal(verts[0], verts[1], verts[2]), verts };
  });
}

function vkey(v: Vec3): string {
  return `${v[0].toFixed(4)},${v[1].toFixed(4)},${v[2].toFixed(4)}`;
}

function near(a: Vec3, b: Vec3, epsilon = 1e-4): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= epsilon;
}

function triangleArea(triangle: Triangle): number {
  const [a, b, c] = triangle.verts;
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  return Math.hypot(cross[0], cross[1], cross[2]) / 2;
}

function withoutSlivers(triangles: readonly Triangle[]): Triangle[] {
  return triangles.filter((triangle) => {
    const [a, b, c] = triangle.verts;
    if (near(a, b) || near(b, c) || near(c, a)) return false;
    return triangleArea(triangle) > 1e-6;
  });
}

export function boundaryEdgeCount(triangles: readonly Triangle[]): number {
  const count = new Map<string, number>();
  const touch = (a: Vec3, b: Vec3) => {
    const ka = vkey(a);
    const kb = vkey(b);
    const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    count.set(id, (count.get(id) ?? 0) + 1);
  };
  for (const tri of triangles) {
    touch(tri.verts[0], tri.verts[1]);
    touch(tri.verts[1], tri.verts[2]);
    touch(tri.verts[2], tri.verts[0]);
  }
  let open = 0;
  for (const n of count.values()) if (n === 1) open += 1;
  return open;
}

function boundaryLoops(triangles: readonly Triangle[]): Vec3[][] {
  const count = new Map<string, number>();
  const ends = new Map<string, [Vec3, Vec3]>();
  const touch = (a: Vec3, b: Vec3) => {
    const ka = vkey(a);
    const kb = vkey(b);
    const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    count.set(id, (count.get(id) ?? 0) + 1);
    ends.set(id, [a, b]);
  };
  for (const tri of triangles) {
    touch(tri.verts[0], tri.verts[1]);
    touch(tri.verts[1], tri.verts[2]);
    touch(tri.verts[2], tri.verts[0]);
  }
  const adj = new Map<string, string[]>();
  const pos = new Map<string, Vec3>();
  const link = (a: Vec3, b: Vec3) => {
    const ka = vkey(a);
    const kb = vkey(b);
    pos.set(ka, a);
    pos.set(kb, b);
    const na = adj.get(ka) ?? [];
    na.push(kb);
    adj.set(ka, na);
  };
  for (const [id, n] of count) {
    if (n !== 1) continue;
    const [a, b] = ends.get(id)!;
    link(a, b);
    link(b, a);
  }
  const unused = new Set<string>();
  for (const [key, neighbors] of adj) {
    for (const next of neighbors) unused.add(`${key}>${next}`);
  }
  const loops: Vec3[][] = [];
  for (const start of adj.keys()) {
    const first = (adj.get(start) ?? []).find((next) => unused.has(`${start}>${next}`));
    if (!first) continue;
    const keys = [start];
    unused.delete(`${start}>${first}`);
    unused.delete(`${first}>${start}`);
    let current = first;
    let guard = 0;
    while (current !== start && guard < 10000) {
      guard += 1;
      keys.push(current);
      const next = (adj.get(current) ?? []).find((candidate) => unused.has(`${current}>${candidate}`));
      if (!next) break;
      unused.delete(`${current}>${next}`);
      unused.delete(`${next}>${current}`);
      current = next;
    }
    const loop = keys.map((key) => pos.get(key)).filter((point): point is Vec3 => Boolean(point));
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function signedArea(loop: readonly XY[]): number {
  let area = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const current = loop[index];
    const next = loop[(index + 1) % loop.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function dedupeRing(loop: readonly Vec3[]): Vec3[] {
  const clean: Vec3[] = [];
  for (const point of loop) {
    const previous = clean[clean.length - 1];
    if (previous && Math.hypot(previous[0] - point[0], previous[1] - point[1]) < 1e-4) continue;
    clean.push(point);
  }
  if (clean.length >= 2) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-4) clean.pop();
  }
  return clean;
}

function capLoop(loop: readonly Vec3[], facing: 'up' | 'down'): Triangle[] {
  const clean = dedupeRing(loop);
  if (clean.length < 3) return [];
  const z = clean.reduce((sum, point) => sum + point[2], 0) / clean.length;
  const area = signedArea(clean.map((point) => [point[0], point[1]]));
  const wantPositive = facing === 'up';
  const ring = (area > 0) === wantPositive ? clean : [...clean].reverse();
  const flat: number[] = [];
  for (const point of ring) flat.push(point[0], point[1]);
  const indices = earcut(flat);
  const triangles: Triangle[] = [];
  for (let index = 0; index < indices.length; index += 3) {
    const a = ring[indices[index]];
    const b = ring[indices[index + 1]];
    const c = ring[indices[index + 2]];
    const verts: [Vec3, Vec3, Vec3] = [
      [a[0], a[1], z],
      [b[0], b[1], z],
      [c[0], c[1], z],
    ];
    triangles.push({ normal: faceNormal(verts[0], verts[1], verts[2]), verts });
  }
  return triangles;
}

export function splitLid(triangles: readonly Triangle[], cap = false): { base: Triangle[]; spark: Triangle[] } {
  const base: Triangle[] = [];
  const spark: Triangle[] = [];
  for (const triangle of triangles) {
    const z = Math.max(triangle.verts[0][2], triangle.verts[1][2], triangle.verts[2][2]);
    if (z > SPARK_SPLIT_Z) spark.push(triangle);
    else base.push(triangle);
  }
  if (!cap) return { base: turnLidAround(base), spark: turnLidAround(spark) };
  // The spark outline is one closed loop. The plate edge under it is the same
  // cut, with a coarser tessellation, so the base is capped from that loop.
  const outline = boundaryLoops(spark);
  for (const loop of outline) {
    base.push(...capLoop(loop, 'up'));
    spark.push(...capLoop(loop, 'down'));
  }
  return { base: turnLidAround(withoutSlivers(base)), spark: turnLidAround(withoutSlivers(spark)) };
}

type Command = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

function sampleCubic(p0: XY, p1: XY, p2: XY, p3: XY, steps: number): XY[] {
  const points: XY[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return points;
}

function sampleQuad(p0: XY, p1: XY, p2: XY, steps: number): XY[] {
  const points: XY[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const u = 1 - t;
    points.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ]);
  }
  return points;
}

function contoursFromCommands(commands: readonly Command[]): XY[][] {
  const contours: XY[][] = [];
  let current: XY[] = [];
  let cursor: XY = [0, 0];
  const push = (points: XY[]) => {
    for (const point of points) {
      const previous = current[current.length - 1];
      if (previous && Math.hypot(previous[0] - point[0], previous[1] - point[1]) < 0.2) continue;
      current.push(point);
      cursor = point;
    }
  };
  for (const command of commands) {
    if (command.type === 'M' && command.x !== undefined && command.y !== undefined) {
      if (current.length >= 3) contours.push(current);
      cursor = [command.x, -command.y];
      current = [cursor];
    } else if (command.type === 'L' && command.x !== undefined && command.y !== undefined) {
      push([[command.x, -command.y]]);
    } else if (command.type === 'C' && command.x !== undefined && command.y !== undefined && command.x1 !== undefined && command.y1 !== undefined && command.x2 !== undefined && command.y2 !== undefined) {
      push(sampleCubic(cursor, [command.x1, -command.y1], [command.x2, -command.y2], [command.x, -command.y], 6));
    } else if (command.type === 'Q' && command.x !== undefined && command.y !== undefined && command.x1 !== undefined && command.y1 !== undefined) {
      push(sampleQuad(cursor, [command.x1, -command.y1], [command.x, -command.y], 6));
    } else if (command.type === 'Z' && current.length >= 3) {
      const first = current[0];
      const last = current[current.length - 1];
      if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.35) current.pop();
      if (current.length >= 3) contours.push(current);
      current = [];
    }
  }
  if (current.length >= 3) contours.push(current);
  return contours;
}

function centroid(poly: readonly XY[]): XY {
  let x = 0;
  let y = 0;
  for (const point of poly) {
    x += point[0];
    y += point[1];
  }
  return [x / poly.length, y / poly.length];
}

function pointInPoly(x: number, y: number, poly: readonly XY[]): boolean {
  let inside = false;
  for (let index = 0, previous = poly.length - 1; index < poly.length; previous = index, index += 1) {
    const xi = poly[index][0];
    const yi = poly[index][1];
    const xj = poly[previous][0];
    const yj = poly[previous][1];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function orient(poly: XY[], positive: boolean): XY[] {
  const area = signedArea(poly);
  if ((area > 0) === positive) return poly;
  return [...poly].reverse();
}

type Shape = { outer: XY[]; holes: XY[][] };

function shapesFromContours(contours: XY[][]): Shape[] {
  const ranked = contours
    .map((contour) => ({ contour, area: Math.abs(signedArea(contour)) }))
    .sort((a, b) => b.area - a.area);
  const shapes: Shape[] = [];
  for (const { contour } of ranked) {
    const [x, y] = centroid(contour);
    let host: Shape | null = null;
    let hostArea = Infinity;
    for (const shape of shapes) {
      const area = Math.abs(signedArea(shape.outer));
      if (area < hostArea && pointInPoly(x, y, shape.outer)) {
        host = shape;
        hostArea = area;
      }
    }
    if (!host) shapes.push({ outer: contour, holes: [] });
    else host.holes.push(contour);
  }
  return shapes;
}

function extrudeShape(shape: Shape, height: number): Triangle[] {
  const outer = orient(shape.outer, true);
  const holes = shape.holes.map((hole) => orient(hole, false));
  const flat: number[] = [];
  const holeIndices: number[] = [];
  const rings = [outer, ...holes];
  for (const ring of rings) {
    if (ring !== outer) holeIndices.push(flat.length / 2);
    for (const point of ring) flat.push(point[0], point[1]);
  }
  const indices = earcut(flat, holeIndices, 2);
  const triangles: Triangle[] = [];
  const at = (index: number, z: number): Vec3 => [flat[index * 2], flat[index * 2 + 1], z];
  for (let index = 0; index < indices.length; index += 3) {
    const top: [Vec3, Vec3, Vec3] = [at(indices[index], height), at(indices[index + 1], height), at(indices[index + 2], height)];
    const bottom: [Vec3, Vec3, Vec3] = [at(indices[index], 0), at(indices[index + 2], 0), at(indices[index + 1], 0)];
    triangles.push({ normal: faceNormal(top[0], top[1], top[2]), verts: top });
    triangles.push({ normal: faceNormal(bottom[0], bottom[1], bottom[2]), verts: bottom });
  }
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      const a0: Vec3 = [a[0], a[1], 0];
      const b0: Vec3 = [b[0], b[1], 0];
      const a1: Vec3 = [a[0], a[1], height];
      const b1: Vec3 = [b[0], b[1], height];
      const first: [Vec3, Vec3, Vec3] = [a0, b0, b1];
      const second: [Vec3, Vec3, Vec3] = [a0, b1, a1];
      triangles.push({ normal: faceNormal(first[0], first[1], first[2]), verts: first });
      triangles.push({ normal: faceNormal(second[0], second[1], second[2]), verts: second });
    }
  }
  return triangles;
}

function placeText(triangles: Triangle[]): Triangle[] {
  if (triangles.length === 0) return triangles;
  const bounds = triangleBounds(triangles);
  const width = Math.max(bounds.max[0] - bounds.min[0], 0.001);
  const height = Math.max(bounds.max[1] - bounds.min[1], 0.001);
  const scale = Math.min(TEXT_MAX_WIDTH / width, TEXT_MAX_HEIGHT / height);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  return triangles.map((triangle) => {
    const verts = triangle.verts.map((vert): Vec3 => [
      (vert[0] - centerX) * scale + TEXT_CENTER_X,
      (vert[1] - centerY) * scale + TEXT_CENTER_Y,
      vert[2] + PLATE_TOP_MM,
    ]) as [Vec3, Vec3, Vec3];
    return { normal: faceNormal(verts[0], verts[1], verts[2]), verts };
  });
}

export function buildLidTextMesh(fontData: ArrayBuffer, text: string): Triangle[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return [];
  const font = opentype.parse(fontData);
  // A stored name can still contain a character this font does not draw.
  const printable = [...cleaned].filter((character) => character === ' ' || font.charToGlyph(character).unicode).join('');
  if (!printable.trim()) return [];
  const path = font.getPath(printable, 0, 0, 100);
  const contours = contoursFromCommands(path.commands as Command[]);
  const triangles = shapesFromContours(contours).flatMap((shape) => extrudeShape(shape, EMBOSS_MM));
  // Each letter stays its own closed shell. Welding a decorative face opens the surface.
  return turnLidAround(placeText(triangles));
}
