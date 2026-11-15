/**
 * Launch colours for the shell and the lid. Add an id here to offer another
 * spool; the shop and submitOrder both read this list.
 */
export const BOX_FILAMENT_IDS = [
  'elegoo-pla-black',
  'elegoo-matte-pla-sakura-pink',
] as const;

export type BoxFilamentId = (typeof BOX_FILAMENT_IDS)[number];

export function isBoxFilament(id: string): boolean {
  return (BOX_FILAMENT_IDS as readonly string[]).includes(id);
}
