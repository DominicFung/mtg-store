import {
  BOX_FACE_HEIGHT,
  BOX_FACE_WIDTHS,
  BOX_WRAP_WIDTH,
  defaultCropBox,
  type SubjectBounds,
} from '../../../packages/print-core/src/outpaint';

const CENTER: SubjectBounds = { left: 0.4, right: 0.6, center: 0.5 };

/** Slice an image that already covers the three-face frame. Pixels are the image's own. */
export async function cropToFaces(
  image: HTMLImageElement,
  subject: SubjectBounds | null,
): Promise<[string, string, string]> {
  const box = defaultCropBox(image.naturalWidth, image.naturalHeight, subject ?? CENTER);
  const crops: [string, string, string] = ['', '', ''];
  let xOffset = 0;
  for (let index = 0; index < 3; index += 1) {
    const boxWidth = box.width * (BOX_FACE_WIDTHS[index] / BOX_WRAP_WIDTH);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(boxWidth));
    canvas.height = Math.max(1, Math.round(canvas.width / (BOX_FACE_WIDTHS[index] / BOX_FACE_HEIGHT)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The crop could not be prepared.');
    context.drawImage(
      image,
      box.x + xOffset,
      box.y,
      boxWidth,
      box.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    crops[index] = canvas.toDataURL('image/png');
    xOffset += boxWidth;
  }
  return crops;
}
