import { PNG } from 'pngjs';
import type { CoreStop } from './colourCore';
import { buildFaceMesh, type FaceMesh, type PrintSettings } from './printGeometry';
import { settingsFromPrintDescription, type FaceStlSettings } from './printDescription';

export type { FaceStlSettings };

function isPng(image: Uint8Array): boolean {
  return image.length >= 8
    && image[0] === 0x89
    && image[1] === 0x50
    && image[2] === 0x4e
    && image[3] === 0x47;
}

function imageRgba(image: Uint8Array): { rgba: Uint8Array; width: number; height: number } {
  if (!isPng(image)) throw new Error('The image buffer must be a PNG');
  const png = PNG.sync.read(Buffer.from(image.buffer, image.byteOffset, image.byteLength));
  return {
    rgba: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength),
    width: png.width,
    height: png.height,
  };
}

/**
 * Build one face STL from a PNG and the print settings (layer heights, depths,
 * and the filament stack). The same function the shop uses for a print file.
 */
export function renderFaceStl(image: Uint8Array, settings: FaceStlSettings): Uint8Array {
  return renderFaceMesh(image, settings).stl;
}

export function renderFaceMesh(image: Uint8Array, settings: FaceStlSettings): FaceMesh {
  if (settings.stops.length === 0) throw new Error('Choose at least one filament');
  const decoded = imageRgba(image);
  const printSettings: PrintSettings = settings;
  const stops: readonly CoreStop[] = settings.stops;
  return buildFaceMesh({
    rgba: decoded.rgba,
    imageWidth: decoded.width,
    imageHeight: decoded.height,
    settings: printSettings,
    stops,
    maxTriangles: Number.POSITIVE_INFINITY,
    header: 'colour core',
  });
}

export function renderFaceStlFromDescription(image: Uint8Array, description: string): Uint8Array {
  return renderFaceStl(image, settingsFromPrintDescription(description));
}
