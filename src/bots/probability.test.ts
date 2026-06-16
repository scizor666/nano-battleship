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

  it('stops chasing a ship once it is fully sunk', () => {
    // A size-2 ship at E6-E7 is hit then sunk. No wounded ships remain, so the
    // bot must NOT keep firing around the dead ship's cells.
    const board = new ShotBoard();
    board.mark({ row: 5, col: 4 }, 'hit');
    board.mark({ row: 5, col: 5 }, 'hit');
    const history = [
      { coord: { row: 5, col: 4 }, result: { kind: 'hit' as const, shipName: 'Destroyer' } },
      {
        coord: { row: 5, col: 5 },
        result: { kind: 'sunk' as const, shipName: 'Destroyer', shipLength: 2 },
      },
    ];

    const sunkNeighbors = new Set([
      '4,4', '6,4', '5,3', // around E6
      '4,5', '6,5', '5,6', // around E7
    ]);

    // With only a size-3 ship left, none of the dead ship's neighbours should be
    // forced picks. Run several times since ties are broken randomly.
    for (let i = 0; i < 30; i += 1) {
      const coord = probabilityChooseMove(board, history, [3]);
      expect(sunkNeighbors.has(`${coord.row},${coord.col}`)).toBe(false);
    }
  });

  it('does not place surviving ships through a sunk ship hull', () => {
    // Sunk size-2 ship occupies A1-A2 (col 0, rows 0-1). A remaining size-3 ship
    // cannot occupy those cells, so A3 (row 2, col 0) should be reachable only
    // via placements that avoid the dead hull — i.e. the dead cells score nothing.
    const board = new ShotBoard();
    board.mark({ row: 0, col: 0 }, 'hit');
    board.mark({ row: 1, col: 0 }, 'hit');
    const history = [
      { coord: { row: 0, col: 0 }, result: { kind: 'hit' as const, shipName: 'Destroyer' } },
      {
        coord: { row: 1, col: 0 },
        result: { kind: 'sunk' as const, shipName: 'Destroyer', shipLength: 2 },
      },
    ];

    // Should never throw and never pick an already-fired (dead) cell.
    const coord = probabilityChooseMove(board, history, [3]);
    expect(board.hasBeenFired(coord)).toBe(false);
  });
});
