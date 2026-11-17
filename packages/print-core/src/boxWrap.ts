/**
 * The stitched artwork reads Right, then Back, then Left. It wraps the shell
 * with the card window at the front (+Z) and the back panel on the spine (−Z).
 * Each panel's right edge meets the next panel's left edge. Nothing is mirrored.
 *
 * Face1 is the −X wall and carries the third panel. Face3 is the +X wall and
 * carries the first panel. Face2 is the spine.
 */
export const SHELL_FACE_CROP = {
  Face1: 2,
  Face2: 1,
  Face3: 0,
} as const;

export type WrapPlate = {
  center: readonly [number, number, number];
  /** Image left-to-right, image bottom-to-top, and outward, in the model. */
  axisX: readonly [number, number, number];
  axisY: readonly [number, number, number];
  axisZ: readonly [number, number, number];
  widthMm: number;
  heightMm: number;
};

/**
 * Relief frames in crop order: right, spine, left.
 * Measured from the face vertices that carry the outward normal.
 */
export const WRAP_PLATES: readonly WrapPlate[] = [
  {
    center: [40.353, -8.436, -11.582],
    axisX: [0, 0, -1],
    axisY: [0, 1, 0],
    axisZ: [1, 0, 0],
    widthMm: 94.48,
    heightMm: 105.41,
  },
  {
    center: [-1.427, -8.288, -59.097],
    axisX: [-1, 0, 0],
    axisY: [0, 1, 0],
    axisZ: [0, 0, -1],
    widthMm: 82.548,
    heightMm: 105.41,
  },
  {
    center: [-42.7, -8.075, -10.892],
    axisX: [0, 0, 1],
    axisY: [0, 1, 0],
    axisZ: [-1, 0, 0],
    widthMm: 94.48,
    heightMm: 105.41,
  },
];
