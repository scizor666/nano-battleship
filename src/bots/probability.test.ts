import { describe, expect, it } from 'vitest';
import { ShotBoard } from '../model/board.ts';
import { probabilityChooseMove } from './probability.ts';

describe('probability bot', () => {
  it('never repeats a fired cell', () => {
    const board = new ShotBoard();
    for (let i = 0; i < 20; i += 1) {
      board.mark({ row: 0, col: i }, 'miss');
    }
    const coord = probabilityChooseMove(board, [], [2]);
    expect(board.hasBeenFired(coord)).toBe(false);
  });

  it('prefers cells adjacent to unresolved hits', () => {
    const board = new ShotBoard();
    const hit = { row: 5, col: 5 };
    const history = [{ coord: hit, result: { kind: 'hit' as const, shipName: 'Cruiser' } }];
    const coord = probabilityChooseMove(board, history, [3]);
    const isNeighbor =
      (coord.row === hit.row && Math.abs(coord.col - hit.col) === 1) ||
      (coord.col === hit.col && Math.abs(coord.row - hit.row) === 1);
    expect(isNeighbor).toBe(true);
  });
});
