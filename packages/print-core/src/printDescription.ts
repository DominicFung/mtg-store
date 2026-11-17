import {
  colorCoreLayerCount,
  hexToRgb,
  layerTopMm,
  type CoreStop,
  type LayerSettings,
} from './colourCore';
import type { PrintSettings } from './printGeometry';

/**
 * Names as they appear in a pasted print-settings description, mapped onto
 * the shop's filament library. Transmission distance comes from the paste.
 */
export const DESCRIPTION_FILAMENTS = [
  { sourceName: 'PETG JAYO Black', shortName: 'Black', libraryId: 'elegoo-pla-black', libraryName: 'Elegoo PLA Black', hex: '#161616' },
  { sourceName: 'PLA BambuLab Matte Dark Brown', shortName: 'Dark Brown', libraryId: 'polyterra-pla-wood-brown', libraryName: 'Polyterra PLA Wood Brown', hex: '#8B5E3C' },
  { sourceName: 'PLA BambuLab Basic Blue', shortName: 'Blue', libraryId: 'elegoo-pla-dark-blue', libraryName: 'Elegoo PLA Dark Blue', hex: '#1A3E78' },
  { sourceName: 'PLA BambuLab Matte Lilac Purple', shortName: 'Lilac Purple', libraryId: 'elegoo-matte-pla-lavender-purple', libraryName: 'Elegoo Matte PLA Lavender Purple', hex: '#9B84C7' },
  { sourceName: 'PLA BambuLab Basic Beige', shortName: 'Beige', libraryId: 'elegoo-pla-beige', libraryName: 'Elegoo PLA Beige', hex: '#E6D5B8' },
  { sourceName: 'PLA Hatchbox Pink', shortName: 'Pink', libraryId: 'elegoo-matte-pla-sakura-pink', libraryName: 'Elegoo Matte PLA Sakura Pink', hex: '#F2A8C0' },
  { sourceName: 'PLA BambuLab Basic Jade White', shortName: 'Jade White', libraryId: 'deeplee-matte-white', libraryName: 'Deeplee Matte White', hex: '#F4F1EA' },
] as const;

export type DescriptionFilament = (typeof DESCRIPTION_FILAMENTS)[number];

export type ParsedFilament = {
  sourceName: string;
  shortName: string;
  libraryId: string;
  libraryName: string;
  hex: string;
  td: number;
  /** Inclusive layer where this filament ends. The top filament runs to the core. */
  endLayer: number;
};

export type ParsedSwap = {
  endLayer: number;
  depthMm: number;
  toShortName: string;
};

export type PrintDescription = {
  projectName: string;
  layerHeightMm: number;
  baseLayerMm: number;
  widthMm: number;
  heightMm: number;
  minDepthMm: number;
  maxDepthMm: number;
  /** Whole millimetres, as printed in the description. */
  actualDepthMm: number;
  filaments: ParsedFilament[];
  swaps: ParsedSwap[];
  startShortName: string;
};

export type FaceStlSettings = PrintSettings & {
  stops: CoreStop[];
};

function mustMatch(text: string, pattern: RegExp, label: string): RegExpMatchArray {
  const match = text.match(pattern);
  if (!match) throw new Error(`Print settings description is missing ${label}`);
  return match;
}

function numberFrom(match: RegExpMatchArray, index: number, label: string): number {
  const value = Number(match[index]);
  if (!Number.isFinite(value)) throw new Error(`Print settings description has a bad ${label}`);
  return value;
}

function libraryFilament(sourceName: string): DescriptionFilament {
  const key = sourceName.trim().replace(/\s+/g, ' ').toLowerCase();
  const found = DESCRIPTION_FILAMENTS.find((filament) => filament.sourceName.toLowerCase() === key);
  if (!found) throw new Error(`No library filament for "${sourceName.trim()}"`);
  return found;
}

function libraryByShortName(shortName: string): DescriptionFilament {
  const key = shortName.trim().toLowerCase();
  const found = DESCRIPTION_FILAMENTS.find((filament) => filament.shortName.toLowerCase() === key);
  if (!found) throw new Error(`No library filament for swap "${shortName.trim()}"`);
  return found;
}

/**
 * Read the plain-text print settings description (project, layer heights,
 * model size, depths, filaments, and swap instructions).
 */
export function parsePrintDescription(text: string): PrintDescription {
  const project = mustMatch(text, /^Project:\s*(.+)\s*$/im, 'a project name');
  const layers = mustMatch(
    text,
    /layer height of\s*([0-9.]+)\s*mm\s+with a base layer of\s*([0-9.]+)\s*mm/i,
    'layer heights',
  );
  const model = mustMatch(text, /The Model is\s*([0-9.]+)\s*x\s*([0-9.]+)\s*mm/i, 'a model size');
  const minDepth = mustMatch(text, /Min Depth of\s*([0-9.]+)\s*mm/i, 'a minimum depth');
  const depths = mustMatch(
    text,
    /Max Depth is\s*([0-9.]+)\s*mm\s+and the Actual Depth is\s*([0-9.]+)\s*mm/i,
    'maximum and actual depth',
  );
  const layerHeightMm = numberFrom(layers, 1, 'layer height');
  const baseLayerMm = numberFrom(layers, 2, 'base layer');
  const settings: LayerSettings = {
    layerHeight: layerHeightMm,
    baseLayerHeight: baseLayerMm,
    minDepth: numberFrom(minDepth, 1, 'minimum depth'),
    maxDepth: numberFrom(depths, 1, 'maximum depth'),
  };

  const filamentLines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /Transmission Distance:/i.test(line));
  if (filamentLines.length === 0) throw new Error('Print settings description has no filaments');
  const used = filamentLines.map((line) => {
    const match = /^(.+?)\s+Transmission Distance:\s*([0-9.]+)\s*$/i.exec(line);
    if (!match) throw new Error(`Could not read filament line "${line}"`);
    const mapped = libraryFilament(match[1]);
    return { mapped, td: numberFrom(match, 2, 'transmission distance') };
  });

  const start = mustMatch(text, /Start with\s+(.+?)\s*$/im, 'a starting filament');
  const startShortName = start[1].trim();
  if (libraryByShortName(startShortName).sourceName !== used[0].mapped.sourceName) {
    throw new Error(`Swap list starts with ${startShortName}, not ${used[0].mapped.shortName}`);
  }

  const swaps: ParsedSwap[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*At layer #(\d+)\s+\(([0-9.]+)mm\)\s+swap to\s+(.+?)\s*$/i.exec(line);
    if (!match) continue;
    const toShortName = match[3].replace(/\s+for the rest\.?$/i, '').trim();
    swaps.push({
      endLayer: numberFrom(match, 1, 'swap layer'),
      depthMm: numberFrom(match, 2, 'swap depth'),
      toShortName,
    });
  }
  if (swaps.length !== used.length - 1) {
    throw new Error(`Expected ${used.length - 1} swaps, found ${swaps.length}`);
  }

  const layerCount = colorCoreLayerCount(settings);
  const filaments: ParsedFilament[] = used.map((row, index) => {
    const endLayer = index === used.length - 1 ? layerCount : swaps[index].endLayer;
    if (index < swaps.length) {
      const next = libraryByShortName(swaps[index].toShortName);
      if (next.sourceName !== used[index + 1].mapped.sourceName) {
        throw new Error(`Swap to ${swaps[index].toShortName} does not match ${used[index + 1].mapped.shortName}`);
      }
      const expected = layerTopMm(swaps[index].endLayer, settings);
      if (Math.abs(expected - swaps[index].depthMm) > 0.02) {
        throw new Error(`Layer ${swaps[index].endLayer} is ${expected} mm, not ${swaps[index].depthMm} mm`);
      }
    }
    return {
      sourceName: row.mapped.sourceName,
      shortName: row.mapped.shortName,
      libraryId: row.mapped.libraryId,
      libraryName: row.mapped.libraryName,
      hex: row.mapped.hex,
      td: row.td,
      endLayer,
    };
  });

  return {
    projectName: project[1].trim(),
    layerHeightMm,
    baseLayerMm,
    widthMm: numberFrom(model, 1, 'model width'),
    heightMm: numberFrom(model, 2, 'model height'),
    minDepthMm: settings.minDepth,
    maxDepthMm: settings.maxDepth,
    actualDepthMm: numberFrom(depths, 2, 'actual depth'),
    filaments,
    swaps,
    startShortName,
  };
}

/** Shop mesh settings for a parsed description. Detail is the 0.10 mm plate. */
export function settingsFromPrintDescription(text: string): FaceStlSettings {
  const parsed = parsePrintDescription(text);
  const stops: CoreStop[] = parsed.filaments.map((filament) => ({
    filament: {
      type: 'PLA',
      brand: null,
      name: filament.libraryName,
      td: filament.td,
    },
    rgb: hexToRgb(filament.hex),
    endLayer: filament.endLayer,
  }));
  return {
    layerHeight: parsed.layerHeightMm,
    baseLayerHeight: parsed.baseLayerMm,
    minDepth: parsed.minDepthMm,
    maxDepth: parsed.maxDepthMm,
    width: parsed.widthMm,
    height: parsed.heightMm,
    nozzleSize: 0.2,
    borderWidth: 0,
    borderDepth: 0,
    detailSize: 0.1,
    smoothing: 4,
    brightnessAdjust: 0,
    maxWidth: 120,
    stops,
  };
}
