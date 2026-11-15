export type DeckPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** object-position when a frame crops a tall photo. */
  focus?: string;
  /** Aspect utility for framed crops. Gallery photos use their real ratio. */
  frame?: string;
};

const base = '/images/deck-boxes';

function photo(
  file: string,
  alt: string,
  width: number,
  height: number,
  focus?: string,
  frame?: string,
): DeckPhoto {
  return { src: `${base}/${file}.webp`, alt, width, height, focus, frame };
}

/** Close corner of the printed portrait, lid on. */
export const heroPhoto = photo(
  'urza-iron-alliance-corner-close-lid-on',
  'Close view of a printed Urza\'s Iron Alliance deck box, with the layered filament portrait wrapping the corner and the lid on',
  1080,
  1920,
  'object-[center_42%]',
);

/** Commander card sitting in the front window. */
export const windowPhoto = photo(
  'urza-iron-alliance-desk-commander-in-window',
  'Urza\'s Iron Alliance deck box on a desk, with the commander card in the front window and the printed portrait on the side',
  768,
  1024,
  'object-bottom',
  'aspect-[5/4]',
);

/** Open box: deck inside, tokens in the rear tray, plus the Elven Council tray. */
export const interiorPhotos: DeckPhoto[] = [
  photo(
    'urza-iron-alliance-open-interior-close',
    'Open deck box with the commander deck inside and tokens stored in the rear tray, lid set beside it',
    768,
    1024,
    'object-center',
  ),
  photo(
    'elven-council-open-tray-with-cards',
    'Open Elven Council deck box with a sleeved deck, a divided token tray at the back, and the commander in the front window',
    665,
    1182,
    'object-[center_68%]',
  ),
];

/** Planeswalker symbol and deck name on the lid. */
export const lidPhoto = photo(
  'urza-iron-alliance-overhead-lid-tokens-and-deck',
  'Top of a deck box lid with a red planeswalker symbol and the deck name, tokens and the deck beside it, commander visible in the front window',
  1080,
  1920,
  'object-[center_20%]',
);

/**
 * Remaining shots, interleaved so similar angles are not stacked.
 * Madame Coco is separate: the file is only 323px wide.
 */
export const galleryPhotos: DeckPhoto[] = [
  photo(
    'urza-iron-alliance-table-window-wide',
    'Deck box by a window with the commander in the front window, tokens, the deck, and a planeswalker deck sleeve',
    768,
    1024,
  ),
  photo(
    'urza-iron-alliance-lid-on-six-tokens',
    'Deck box with the lid on and six tokens in blue, gold, and black in front of the printed portrait',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-open-interior-lid-angled',
    'Open deck box from above, deck inside and tokens in the back tray, lid beside it on the table',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-open-interior-lid-below',
    'Open deck box looking down into the deck and token tray, with the lid below the box',
    768,
    1024,
  ),
  photo(
    'urza-iron-alliance-table-window-pullback',
    'Deck box pulled back on a wooden table, commander card readable in the front window, tokens and deck beside it',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-corner-tokens-window-view',
    'Corner of the printed deck box showing the layered filament portrait, with tokens in front',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-lid-on-four-tokens',
    'Deck box with the lid on and four tokens in front of the printed portrait',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-table-window-from-left',
    'Deck box from the left, printed portrait on the side, commander window, tokens and deck on the table',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-open-interior-lid-beside',
    'Open deck box with the lid set to the side and the deck stored inside',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-table-window-tokens-and-deck',
    'Deck box with the front window, tokens, and the deck stacked beside it on a wooden table',
    1080,
    1920,
  ),
  photo(
    'urza-iron-alliance-corner-tokens-and-mana-lid',
    'Printed deck box with the planeswalker symbol on the lid and tokens arranged in front',
    1080,
    1920,
  ),
];

/** 323×576. Keep the rendered width at or below the file width. */
export const accentPhoto = photo(
  'madame-coco-pink-box-held-in-hand',
  'Small pink Madame Coco deck box held in a hand, with the commander card in the front window',
  323,
  576,
);

export const everyHomePhoto: DeckPhoto[] = [
  heroPhoto,
  windowPhoto,
  ...interiorPhotos,
  lidPhoto,
  ...galleryPhotos,
  accentPhoto,
];
