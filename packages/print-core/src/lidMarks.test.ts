import { describe, expect, it } from '@jest/globals';
import {
  boxFilamentForSource,
  lidMarkById,
  lidMarkForFilaments,
  LID_MARKS,
} from './lidMarks';

describe('lid colours', () => {
  it('locks the shell to pink for the example and black for everything else', () => {
    expect(boxFilamentForSource('example')).toBe('elegoo-matte-pla-sakura-pink');
    expect(boxFilamentForSource('upload')).toBe('elegoo-pla-black');
    expect(boxFilamentForSource('scryfall')).toBe('elegoo-pla-black');
  });

  it('offers white, beige, and a red logo with a white name', () => {
    expect(LID_MARKS.map((mark) => mark.id)).toEqual(['white', 'beige', 'red-white']);
    expect(lidMarkById('beige').logoFilamentId).toBe('elegoo-pla-beige');
    expect(lidMarkById('beige').textFilamentId).toBe('elegoo-pla-beige');
    expect(lidMarkById('white').logoFilamentId).toBe('deeplee-matte-white');
    const split = lidMarkForFilaments('elegoo-pla-red', 'deeplee-matte-white');
    expect(split?.split).toBe(true);
    expect(lidMarkForFilaments('elegoo-pla-red', 'elegoo-pla-red')).toBeNull();
  });
});
