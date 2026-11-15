import { PNG } from 'pngjs';
import JSZip from 'jszip';
import {
  colorCoreLayerCount,
  formatDetails,
  formatSwapDepth,
  layerTopMm,
  renderBlendedRgba,
  shortFilamentName,
  TRANSMISSION_DENSITY,
  type CoreStop,
} from '../../../packages/print-core/src/hueforge';
import {
  buildFaceMesh,
  canonicalFaceName,
  FACE_NAMES,
  modelSizeForCrop,
  clampToMaxWidth,
  type PrintSettings,
} from '../../../packages/print-core/src/printGeometry';

const RECORD_EDGE = 1400;

export type ArchiveFace = {
  /** Current name, or a legacy "front" / "back" key from an older order. */
  name: string;
  rgba: Uint8Array;
  width: number;
  height: number;
  cropPng: Uint8Array;
};

function fit(rgba: Uint8Array, width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { rgba, width, height };
  const scale = maxEdge / longest;
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * nextWidth + x) * 4;
      out[to] = rgba[from];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from + 2];
      out[to + 3] = rgba[from + 3];
    }
  }
  return { rgba: out, width: nextWidth, height: nextHeight };
}

function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(png.data);
  return PNG.sync.write(png);
}

export function decodePng(bytes: Uint8Array): { rgba: Uint8Array; width: number; height: number } {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength), width: png.width, height: png.height };
}

export type ArchiveLid = {
  boxBody: Uint8Array;
  base: Uint8Array;
  spark: Uint8Array;
  text?: Uint8Array | null;
  coloursText: string;
  manifest: Record<string, unknown>;
};

export async function buildOrderZip(input: {
  orderNumber: string;
  settings: PrintSettings;
  stops: readonly CoreStop[];
  faces: readonly ArchiveFace[];
  lid?: ArchiveLid | null;
}): Promise<Buffer> {
  if (input.faces.length !== 3) throw new Error('Three faces are required');
  const zip = new JSZip();
  const layerCount = colorCoreLayerCount(input.settings);
  const faces: Array<Record<string, unknown>> = [];

  for (const face of input.faces) {
    const faceName = canonicalFaceName(face.name);
    if (!faceName) throw new Error(`Unknown face ${face.name}`);
    const fitted = clampToMaxWidth(
      modelSizeForCrop(face.width, face.height, input.settings.height),
      input.settings.maxWidth,
    );
    const mesh = buildFaceMesh({
      rgba: face.rgba,
      imageWidth: face.width,
      imageHeight: face.height,
      settings: input.settings,
      stops: input.stops,
      header: 'HueForge',
      maxTriangles: Number.POSITIVE_INFINITY,
    });
    const project = `${input.orderNumber}-${faceName}.hfp`;
    zip.file(`${faceName}.stl`, mesh.stl);
    zip.file(`${faceName}-details.txt`, formatDetails({
      projectName: project,
      widthMm: fitted.widthMm,
      heightMm: fitted.heightMm,
      settings: input.settings,
      stops: input.stops,
    }));
    const preview = fit(face.rgba, face.width, face.height, RECORD_EDGE);
    const blended = renderBlendedRgba({
      rgba: preview.rgba,
      width: preview.width,
      height: preview.height,
      modelWidthMm: fitted.widthMm,
      modelHeightMm: fitted.heightMm,
      stops: input.stops,
      settings: input.settings,
    });
    zip.file(`crop-${FACE_NAMES.indexOf(faceName) + 1}.png`, face.cropPng);
    zip.file(`layered-${FACE_NAMES.indexOf(faceName) + 1}.png`, encodePng(blended, preview.width, preview.height));
    faces.push({
      face: faceName,
      project,
      stl: `${faceName}.stl`,
      details: `${faceName}-details.txt`,
      widthMm: fitted.widthMm,
      heightMm: fitted.heightMm,
      meshWidthMm: mesh.widthMm,
      meshHeightMm: mesh.heightMm,
      cropPx: [face.width, face.height],
      grid: [mesh.cols, mesh.rows],
      stepMm: mesh.stepMm,
      triangles: mesh.triangles,
      actualDepthMm: mesh.actualDepthMm,
      capped: false,
    });
  }

  if (input.lid) {
    zip.file('box-body.stl', input.lid.boxBody);
    zip.file('lid-base.stl', input.lid.base);
    zip.file('lid-spark.stl', input.lid.spark);
    if (input.lid.text) zip.file('lid-text.stl', input.lid.text);
    zip.file('lid-colours.txt', input.lid.coloursText);
  }

  zip.file('filament-layers.json', JSON.stringify({
    note: 'One full-resolution HueForge colour-core STL per face. Customers do not receive this zip.',
    luminance: 'BT.601 luminance, smoothed by one 3x3 at a 0.10 mm detail size (coarser grids keep that blur width), stretched from black to white, then shifted by brightnessAdjust and clamped. Heights run from min depth to the top of the colour core. The +X and +Y edges are a one-cell lip at layer height and the back is flat at Z 0.',
    transmission: {
      model: '0.05 ** ((thicknessMm / td) * density)',
      density: TRANSMISSION_DENSITY,
    },
    print: {
      layerHeightMm: input.settings.layerHeight,
      baseLayerHeightMm: input.settings.baseLayerHeight,
      minDepthMm: input.settings.minDepth,
      maxDepthMm: input.settings.maxDepth,
      borderWidthMm: input.settings.borderWidth,
      borderDepthMm: input.settings.borderDepth,
      detailSizeMm: input.settings.detailSize,
      faceHeightMm: input.settings.height,
      nozzleSizeMm: input.settings.nozzleSize,
      brightnessAdjust: input.settings.brightnessAdjust ?? 0,
      maxWidthMm: input.settings.maxWidth ?? null,
      layerCount,
      triangleCap: null,
    },
    stops: input.stops.map((stop, index) => ({
      index,
      endLayer: stop.endLayer,
      depthMm: layerTopMm(stop.endLayer, input.settings),
      depthLabel: formatSwapDepth(stop.endLayer, input.settings),
      type: stop.filament.type ?? 'PLA',
      brand: stop.filament.brand ?? null,
      name: shortFilamentName(stop.filament),
      td: stop.filament.td,
    })),
    faces,
    lid: input.lid?.manifest ?? null,
  }, null, 2));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}
