/**
 * Filaments the shop sells, for the deck-box layer preview.
 *
 * `hex` and `td` are APPROXIMATE PLACEHOLDERS. They are not measured from the
 * spools. `td` is a HueForge-style transmission distance in millimetres (lower
 * means the colour covers what is underneath sooner). Replace both fields with
 * measured values and set `approximate` to false when that is done.
 *
 * Keep this list in sync with aws/seeds/filaments.json.
 */

export type FilamentFinish = 'standard' | 'matte' | 'silk' | 'pro' | 'wood';

export type Filament = {
  id: string;
  name: string;
  /** Unmeasured stand-in colour. Not a scan of the spool. */
  hex: string;
  /** Unmeasured transmission distance in millimetres. */
  td: number;
  inStock: boolean;
  brand: string | null;
  material: string | null;
  finish: FilamentFinish | null;
  sortOrder: number;
  /** True while hex and td are still the placeholder estimates. */
  approximate: boolean;
};

export type FilamentLayerSettings = {
  /** Bottom (printed first, shadows) to top (highlights). */
  layers: Filament[];
  /** Luminance hand-off of each layer except the last. Length is layers.length - 1. */
  boundaries: number[];
};

export const MOCK_FILAMENTS: Filament[] = [
  {
    id: 'elegoo-pla-red',
    name: 'Elegoo PLA Red',
    hex: '#D4252B',
    td: 3.4,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'standard',
    sortOrder: 10,
    approximate: true,
  },
  {
    id: 'elegoo-pla-black',
    name: 'Elegoo PLA Black',
    hex: '#161616',
    td: 0.5,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'standard',
    sortOrder: 20,
    approximate: true,
  },
  // Light oak. Wood-filled PLA, so the placeholder TD is lower than a plain colour.
  {
    id: 'elegoo-pla-oak-wood',
    name: 'Elegoo PLA Oak Wood',
    hex: '#C49A6C',
    td: 1.6,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'wood',
    sortOrder: 30,
    approximate: true,
  },
  {
    id: 'elegoo-matte-pla-lavender-purple',
    name: 'Elegoo Matte PLA Lavender Purple',
    hex: '#9B84C7',
    td: 3.2,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'matte',
    sortOrder: 40,
    approximate: true,
  },
  {
    id: 'elegoo-pla-gray',
    name: 'Elegoo PLA Gray',
    hex: '#8E9297',
    td: 2.4,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'standard',
    sortOrder: 50,
    approximate: true,
  },
  {
    id: 'elegoo-pla-pro-burgundy-red',
    name: 'Elegoo PLA Pro Burgundy Red',
    hex: '#72243E',
    td: 2.0,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'pro',
    sortOrder: 60,
    approximate: true,
  },
  {
    id: 'elegoo-pla-dark-blue',
    name: 'Elegoo PLA Dark Blue',
    hex: '#1A3E78',
    td: 1.2,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'standard',
    sortOrder: 70,
    approximate: true,
  },
  // PolyTerra is Polymaker's matte line. Wood Brown is the colour, not a wood-fiber spool.
  {
    id: 'polyterra-pla-wood-brown',
    name: 'Polyterra PLA Wood Brown',
    hex: '#8B5E3C',
    td: 1.8,
    inStock: true,
    brand: 'Polymaker',
    material: 'PLA',
    finish: 'matte',
    sortOrder: 80,
    approximate: true,
  },
  {
    id: 'giantarm-silk-silver',
    name: 'GiantArm Silk Silver',
    hex: '#D5DCE3',
    td: 1.7,
    inStock: true,
    brand: 'GiantArm',
    material: 'PLA',
    finish: 'silk',
    sortOrder: 90,
    approximate: true,
  },
  {
    id: 'elegoo-pla-beige',
    name: 'Elegoo PLA Beige',
    hex: '#E6D5B8',
    td: 4.4,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'standard',
    sortOrder: 100,
    approximate: true,
  },
  {
    id: 'elegoo-matte-pla-sakura-pink',
    name: 'Elegoo Matte PLA Sakura Pink',
    hex: '#F2A8C0',
    td: 4.8,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'matte',
    sortOrder: 110,
    approximate: true,
  },
  {
    id: 'elegoo-matte-pla-ice-blue',
    name: 'Elegoo Matte PLA Ice Blue',
    hex: '#A9D4EA',
    td: 5.6,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'matte',
    sortOrder: 120,
    approximate: true,
  },
  {
    id: 'elegoo-matte-pla-sunshine-yellow',
    name: 'Elegoo Matte PLA Sunshine Yellow',
    hex: '#F6D32A',
    td: 6.2,
    inStock: true,
    brand: 'Elegoo',
    material: 'PLA',
    finish: 'matte',
    sortOrder: 130,
    approximate: true,
  },
];

/** Bottom to top. Readable on a first preview: dark backing, then lighter coverings. */
export const DEFAULT_LAYER_IDS = [
  'elegoo-pla-black',
  'elegoo-pla-dark-blue',
  'elegoo-pla-red',
  'elegoo-pla-oak-wood',
  'giantarm-silk-silver',
];

export function sortFilaments(filaments: Filament[]): Filament[] {
  return [...filaments].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function defaultLayerSelection(filaments: Filament[]): Filament[] {
  const byId = new Map(filaments.map((filament) => [filament.id, filament]));
  const picked = DEFAULT_LAYER_IDS.map((id) => byId.get(id)).filter((filament): filament is Filament => Boolean(filament));
  if (picked.length >= 2) return picked;
  const inStock = filaments.filter((filament) => filament.inStock);
  const pool = inStock.length >= 2 ? inStock : filaments;
  return pool.slice(0, Math.min(4, pool.length));
}

export function filamentsAreApproximate(filaments: Filament[]): boolean {
  return filaments.length > 0 && filaments.every((filament) => filament.approximate);
}
