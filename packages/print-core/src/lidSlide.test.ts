import { describe, expect, it } from '@jest/globals';
import {
  LID_CLOSED_FRACTION,
  LID_OPEN_TRAVEL_MM,
  LID_SEATED_OFFSET_MM,
  clampLidOffset,
  clampLidOpen,
  lidSlideOffset,
} from './lidGeometry';

describe('lid slide', () => {
  it('keeps the slider minimum on the seated offset and clamps anything further in', () => {
    expect(LID_CLOSED_FRACTION).toBe(0.1);
    expect(LID_SEATED_OFFSET_MM).toBeCloseTo(7.2);
    expect(LID_SEATED_OFFSET_MM).toBe(LID_CLOSED_FRACTION * LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(0)).toBe(LID_SEATED_OFFSET_MM);
    expect(clampLidOpen(-1)).toBe(0);
    expect(clampLidOpen(Number.NaN)).toBe(0);
    for (const open of [-2, -0.01, 0, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(lidSlideOffset(open)).toBe(LID_SEATED_OFFSET_MM);
    }
    expect(clampLidOffset(0)).toBe(LID_SEATED_OFFSET_MM);
    expect(clampLidOffset(7.19)).toBe(LID_SEATED_OFFSET_MM);
    expect(clampLidOffset(-20)).toBe(LID_SEATED_OFFSET_MM);
    expect(clampLidOffset(LID_SEATED_OFFSET_MM)).toBe(LID_SEATED_OFFSET_MM);
    expect(lidSlideOffset(1)).toBe(LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(2)).toBe(LID_OPEN_TRAVEL_MM);
    expect(clampLidOffset(LID_OPEN_TRAVEL_MM + 10)).toBe(LID_OPEN_TRAVEL_MM);
    expect(lidSlideOffset(0.5)).toBeCloseTo(LID_SEATED_OFFSET_MM + 0.5 * (LID_OPEN_TRAVEL_MM - LID_SEATED_OFFSET_MM));
    expect(lidSlideOffset(0.5)).toBeGreaterThan(LID_SEATED_OFFSET_MM);
    expect(lidSlideOffset(0.5)).toBeLessThan(LID_OPEN_TRAVEL_MM);
  });
});