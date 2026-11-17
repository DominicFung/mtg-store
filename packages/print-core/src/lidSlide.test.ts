import { describe, expect, it } from '@jest/globals';
import { LID_CLOSED_FRACTION, LID_OPEN_TRAVEL_MM, lidSlideOffset } from './lidGeometry';

describe('lid slide', () => {
  it('seats the closed slider a tenth of the way out and still opens fully', () => {
    expect(LID_CLOSED_FRACTION).toBe(0.1);
    expect(lidSlideOffset(0)).toBeCloseTo(0.1 * LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(1)).toBe(LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(0.5)).toBeCloseTo((0.1 + 0.5 * 0.9) * LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(-1)).toBe(lidSlideOffset(0));
    expect(lidSlideOffset(2)).toBe(lidSlideOffset(1));
  });
});
