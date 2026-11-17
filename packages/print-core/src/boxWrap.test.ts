import { describe, expect, it } from '@jest/globals';
import { SHELL_FACE_CROP, WRAP_PLATES } from './boxWrap';

describe('box wrap', () => {
  it('puts the first panel on the +X wall and the third on the −X wall', () => {
    expect(SHELL_FACE_CROP.Face3).toBe(0);
    expect(SHELL_FACE_CROP.Face2).toBe(1);
    expect(SHELL_FACE_CROP.Face1).toBe(2);
    expect(WRAP_PLATES[SHELL_FACE_CROP.Face3].center[0]).toBeGreaterThan(0);
    expect(WRAP_PLATES[SHELL_FACE_CROP.Face1].center[0]).toBeLessThan(0);
    expect(WRAP_PLATES[SHELL_FACE_CROP.Face2].center[2]).toBeLessThan(-40);
  });

  it('keeps the panorama continuous and the normals pointing outward', () => {
    const [right, spine, left] = WRAP_PLATES;
    expect(right.axisZ[0]).toBeGreaterThan(0);
    expect(spine.axisZ[2]).toBeLessThan(0);
    expect(left.axisZ[0]).toBeLessThan(0);
    // Right's image-right edge runs toward the spine, and the spine's
    // image-left edge runs back toward that same +X wall.
    expect(right.axisX[2]).toBeLessThan(0);
    expect(spine.axisX[0]).toBeLessThan(0);
    // The spine's image-right edge runs toward the −X wall, which is where
    // the third panel's image-left edge sits.
    expect(left.axisX[2]).toBeGreaterThan(0);
    expect(right.axisY[1]).toBe(1);
    expect(spine.axisY[1]).toBe(1);
    expect(left.axisY[1]).toBe(1);
  });
});
