import { Filament, MOCK_FILAMENTS, sortFilaments } from './filamentCatalogue';
import { clampStops, layerTopMm, type LayerSettings } from './colourCore';

export const EXAMPLE_ID = 'winter-dogs';

export const EXAMPLE_STITCHED = '/examples/winter-dogs/stitched.png';

export const EXAMPLE_FACES = [
  '/examples/winter-dogs/right-1.png',
  '/examples/winter-dogs/back-2.png',
  '/examples/winter-dogs/left-3.png',
] as const;

export const DEEPLEE_MATTE_WHITE: Filament = {
  id: 'deeplee-matte-white',
  name: 'Deeplee Matte White',
  hex: '#F4F1EA',
  td: 5,
  inStock: true,
  brand: 'Deeplee',
  material: 'PLA',
  finish: 'matte',
  sortOrder: 140,
  approximate: true,
  type: 'PLA',
};

/** Bottom to top. End layers are inclusive; the last one is the top of the core. */
export const EXAMPLE_LAYER_IDS = [
  'elegoo-pla-black',
  'polyterra-pla-wood-brown',
  'elegoo-pla-dark-blue',
  'elegoo-matte-pla-lavender-purple',
  'elegoo-pla-beige',
  'elegoo-matte-pla-sakura-pink',
  'deeplee-matte-white',
] as const;

/** Transmission distances for this design. Other catalogue rows keep their own values. */
export const EXAMPLE_TD: Record<string, number> = {
  'elegoo-pla-black': 0.3,
  'polyterra-pla-wood-brown': 2,
  'elegoo-pla-dark-blue': 4,
  'elegoo-matte-pla-lavender-purple': 2,
  'elegoo-pla-beige': 8,
  'elegoo-matte-pla-sakura-pink': 12,
  'deeplee-matte-white': 5,
};

/** Inclusive end layer of every filament except the top, which runs to the core. */
const EXAMPLE_END_LAYERS = [2, 5, 12, 17, 34, 38];

/** Layer whose top is the depth quoted for the start of each filament after black. */
export const EXAMPLE_START_LAYERS = [1, 3, 6, 13, 18, 35, 39];

export function exampleEndLayers(layerCount: number): number[] {
  return clampStops([...EXAMPLE_END_LAYERS, layerCount], layerCount);
}

export function withDeeplee(filaments: readonly Filament[]): Filament[] {
  if (filaments.some((filament) => filament.id === DEEPLEE_MATTE_WHITE.id)) return sortFilaments(filaments);
  return sortFilaments([...filaments, DEEPLEE_MATTE_WHITE]);
}

export function exampleLayers(filaments: readonly Filament[]): Filament[] {
  const byId = new Map<string, Filament>();
  for (const filament of [...MOCK_FILAMENTS, DEEPLEE_MATTE_WHITE, ...filaments]) {
    byId.set(filament.id, filament);
  }
  return EXAMPLE_LAYER_IDS.map((id) => {
    const filament = byId.get(id);
    if (!filament) throw new Error(`Missing filament ${id}`);
    return { ...filament, td: EXAMPLE_TD[id] ?? filament.td };
  });
}

export function exampleStartDepths(settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): number[] {
  return EXAMPLE_START_LAYERS.map((layer) => layerTopMm(layer, settings));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the example'));
    reader.readAsDataURL(blob);
  });
}

/** PNG data URLs, so the order upload can read the same bytes as a customer crop. */
export async function loadExampleCrops(): Promise<[string, string, string]> {
  const urls = await Promise.all(EXAMPLE_FACES.map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load the example');
    return blobToDataUrl(await response.blob());
  }));
  return [urls[0] ?? '', urls[1] ?? '', urls[2] ?? ''];
}
