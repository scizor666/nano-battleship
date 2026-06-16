import { describe, expect, it } from 'vitest';
import { ShotBoard } from '../model/board.ts';
import {
  createHuntTargetState,
  huntTargetAfterShot,
  huntTargetChooseMove,
} from './huntTarget.ts';

describe('huntTarget bot', () => {
  it('fires only untouched cells', () => {
    const board = new ShotBoard();
    board.mark({ row: 0, col: 0 }, 'miss');
    const { coord } = huntTargetChooseMove(
      board,
      [{ coord: { row: 0, col: 0 }, result: { kind: 'miss' } }],
      [5, 4, 3, 3, 2],
      createHuntTargetState(),
    );
    expect(board.hasBeenFired(coord)).toBe(false);
  });

  it('targets orthogonal neighbors after a hit', () => {
    const board = new ShotBoard();
    const hit = { row: 4, col: 4 };
    const history = [{ coord: hit, result: { kind: 'hit' as const, shipName: 'Sub' } }];
    const { coord } = huntTargetChooseMove(
      board,
      history,
      [3, 2],
      createHuntTargetState(),
    );
    const isNeighbor =
      (coord.row === hit.row && Math.abs(coord.col - hit.col) === 1) ||
      (coord.col === hit.col && Math.abs(coord.row - hit.row) === 1);
    expect(isNeighbor).toBe(true);
  });

  it('clears unresolved hits after a sink', () => {
    const state = huntTargetAfterShot(createHuntTargetState(), {
      coord: { row: 2, col: 2 },
      result: { kind: 'hit', shipName: 'Destroyer' },
    });
    expect(state.unresolvedHits).toHaveLength(1);
    const afterSink = huntTargetAfterShot(state, {
      coord: { row: 2, col: 2 },
      result: { kind: 'sunk', shipName: 'Destroyer', shipLength: 2 },
    });
    expect(afterSink.unresolvedHits).toHaveLength(0);
  });
});
