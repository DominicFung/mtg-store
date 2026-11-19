import { Filament, MOCK_FILAMENTS, sortFilaments } from './filamentCatalogue';
import { clampStops, layerTopMm, type LayerSettings } from './colourCore';

export const EXAMPLE_ID = 'winter-dogs';

/** Lid colours applied only when this example is chosen. */
export const EXAMPLE_BOX_FILAMENT_ID = 'elegoo-matte-pla-sakura-pink';
export const EXAMPLE_LOGO_FILAMENT_ID = 'deeplee-matte-white';
export const EXAMPLE_TEXT_FILAMENT_ID = 'deeplee-matte-white';

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

export type ExampleId = 'pink-doggo' | 'red-dragon';

export const DRAGON_BOX_FILAMENT_ID = 'elegoo-pla-black';
/** Reference plates top out at 2.05 mm, which this mesh reaches when max depth is 2.01. */
export const DRAGON_MAX_DEPTH = 2.01;
export const DRAGON_STITCHED = '/examples/red-dragon/stitched.png';
export const DRAGON_FACES = [
  '/examples/red-dragon/right-1.png',
  '/examples/red-dragon/back-2.png',
  '/examples/red-dragon/left-3.png',
] as const;
export const DRAGON_LAYER_IDS = [
  'elegoo-pla-black',
  'elegoo-pla-pro-burgundy-red',
  'elegoo-pla-red',
  '3dhojor-pla-orange',
  'elegoo-matte-pla-sunshine-yellow',
  'deeplee-matte-white',
] as const;
export const DRAGON_TD: Record<string, number> = {
  'elegoo-pla-black': 0.5,
  'elegoo-pla-pro-burgundy-red': 2,
  'elegoo-pla-red': 3.4,
  '3dhojor-pla-orange': 5,
  'elegoo-matte-pla-sunshine-yellow': 6.2,
  'deeplee-matte-white': 5,
};
const DRAGON_END_LAYERS = [3, 18, 26, 30, 40];
export const DRAGON_START_LAYERS = [1, 4, 19, 27, 31, 41];

export function dragonEndLayers(layerCount: number): number[] {
  return clampStops([...DRAGON_END_LAYERS, layerCount], layerCount);
}

export function dragonLayers(filaments: readonly Filament[]): Filament[] {
  const byId = new Map<string, Filament>();
  for (const filament of [...MOCK_FILAMENTS, DEEPLEE_MATTE_WHITE, ...filaments]) {
    byId.set(filament.id, filament);
  }
  return DRAGON_LAYER_IDS.map((id) => {
    const filament = byId.get(id);
    if (!filament) throw new Error(`Missing filament ${id}`);
    return { ...filament, td: DRAGON_TD[id] ?? filament.td };
  });
}

export function dragonStartDepths(settings: Pick<LayerSettings, 'baseLayerHeight' | 'layerHeight'>): number[] {
  return DRAGON_START_LAYERS.map((layer) => layerTopMm(layer, settings));
}

export function exampleFaces(id: ExampleId): readonly [string, string, string] {
  return id === 'red-dragon' ? DRAGON_FACES : EXAMPLE_FACES;
}

export function exampleStitched(id: ExampleId): string {
  return id === 'red-dragon' ? DRAGON_STITCHED : EXAMPLE_STITCHED;
}

/** PNG data URLs, so the order upload can read the same bytes as a customer crop. */
export async function loadExampleCrops(id: ExampleId = 'pink-doggo'): Promise<[string, string, string]> {
  const urls = await Promise.all(exampleFaces(id).map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load the example');
    return blobToDataUrl(await response.blob());
  }));
  return [urls[0] ?? '', urls[1] ?? '', urls[2] ?? ''];
}
