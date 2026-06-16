import { describe, expect, it } from 'vitest';
import { ShotBoard } from './board.ts';

describe('ShotBoard', () => {
  it('tracks untouched, miss, and hit states', () => {
    const board = new ShotBoard();
    const coord = { row: 2, col: 3 };
    expect(board.getState(coord)).toBe('untouched');
    expect(board.hasBeenFired(coord)).toBe(false);

    board.mark(coord, 'miss');
    expect(board.getState(coord)).toBe('miss');
    expect(board.hasBeenFired(coord)).toBe(true);
  });

  it('lists untouched cells excluding fired cells', () => {
    const board = new ShotBoard();
    board.mark({ row: 0, col: 0 }, 'hit');
    const untouched = board.untouchedCells();
    expect(untouched).toHaveLength(99);
    expect(untouched.some((c) => c.row === 0 && c.col === 0)).toBe(false);
  });

  it('clones independently', () => {
    const board = new ShotBoard();
    board.mark({ row: 1, col: 1 }, 'miss');
    const copy = board.clone();
    copy.mark({ row: 2, col: 2 }, 'hit');
    expect(board.getState({ row: 2, col: 2 })).toBe('untouched');
    expect(copy.getState({ row: 1, col: 1 })).toBe('miss');
  });
});
