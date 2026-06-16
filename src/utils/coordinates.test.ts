import { describe, expect, it } from 'vitest';
import {
  coordToLabel,
  inBounds,
  labelToCoord,
} from '../utils/coordinates.ts';

describe('coordinates', () => {
  it('converts between labels and coordinates', () => {
    expect(coordToLabel({ row: 0, col: 0 })).toBe('A1');
    expect(coordToLabel({ row: 3, col: 2 })).toBe('C4');
    expect(labelToCoord('C4')).toEqual({ row: 3, col: 2 });
    expect(labelToCoord('bad')).toBeNull();
  });

  it('checks bounds for 10x10 grid', () => {
    expect(inBounds({ row: 0, col: 9 })).toBe(true);
    expect(inBounds({ row: 10, col: 0 })).toBe(false);
    expect(inBounds({ row: -1, col: 0 })).toBe(false);
  });
});
