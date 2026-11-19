/** Shell colour is fixed by where the art came from. */
export type ArtSource = 'example' | 'upload' | 'scryfall';

export const BOX_BLACK_ID = 'elegoo-pla-black';
export const BOX_PINK_ID = 'elegoo-matte-pla-sakura-pink';

export function artSourceOf(value: string | null | undefined): ArtSource {
  if (value === 'example' || value === 'scryfall' || value === 'upload') return value;
  return 'upload';
}

export function boxFilamentForSource(source: ArtSource): string {
  return source === 'example' ? BOX_PINK_ID : BOX_BLACK_ID;
}

export type LidMark = {
  id: 'white' | 'beige' | 'red-white';
  name: string;
  /** Shown under the swatch. */
  detail: string;
  logoFilamentId: string;
  textFilamentId: string;
  /** Diagonal split: red logo, white name. */
  split: boolean;
};

/**
 * One choice colours both the Magic logo and the lid name.
 * White is Deeplee Matte White. Beige is Elegoo PLA Beige.
 * The split swatch is Elegoo PLA Red on the logo and Deeplee Matte White on the name.
 */
export const LID_MARKS: readonly LidMark[] = [
  {
    id: 'white',
    name: 'White',
    detail: 'Deeplee Matte White on the logo and the name',
    logoFilamentId: 'deeplee-matte-white',
    textFilamentId: 'deeplee-matte-white',
    split: false,
  },
  {
    id: 'beige',
    name: 'Beige',
    detail: 'Elegoo PLA Beige on the logo and the name',
    logoFilamentId: 'elegoo-pla-beige',
    textFilamentId: 'elegoo-pla-beige',
    split: false,
  },
  {
    id: 'red-white',
    name: 'Red logo, white name',
    detail: 'Elegoo PLA Red on the logo, Deeplee Matte White on the name',
    logoFilamentId: 'elegoo-pla-red',
    textFilamentId: 'deeplee-matte-white',
    split: true,
  },
];

export const DEFAULT_LID_MARK_ID: LidMark['id'] = 'red-white';
export const EXAMPLE_LID_MARK_ID: LidMark['id'] = 'white';

export function lidMarkById(id: string | null | undefined): LidMark {
  return LID_MARKS.find((mark) => mark.id === id) ?? LID_MARKS[2];
}

export function lidMarkForFilaments(logoFilamentId: string, textFilamentId: string | null | undefined): LidMark | null {
  return LID_MARKS.find((mark) => mark.logoFilamentId === logoFilamentId && mark.textFilamentId === textFilamentId) ?? null;
}
