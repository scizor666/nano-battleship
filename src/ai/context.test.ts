import { describe, expect, it } from 'vitest';
import { buildTacticalCandidates, buildFogGrid } from './context.ts';
import { ShotBoard } from '../model/board.ts';

describe('buildTacticalCandidates', () => {
  it('never includes already-fired cells in candidates', () => {
    const board = new ShotBoard();
    board.mark({ row: 0, col: 0 }, 'miss');
    const history = [{ coord: { row: 0, col: 0 }, result: { kind: 'miss' as const } }];
    const tactical = buildTacticalCandidates(board, history, [5, 4, 3, 3, 2]);
    for (const cell of tactical.candidates) {
      expect(board.hasBeenFired(cell)).toBe(false);
    }
    expect(tactical.forbidden).toEqual(['A1']);
  });

  it('switches to target mode when unresolved hits exist', () => {
    const board = new ShotBoard();
    const history = [
      { coord: { row: 4, col: 4 }, result: { kind: 'hit' as const, shipName: 'Sub' } },
    ];
    const tactical = buildTacticalCandidates(board, history, [3, 2]);
    expect(tactical.mode).toBe('target');
    const labels = tactical.candidates.map((c) => `${String.fromCharCode(65 + c.col)}${c.row + 1}`);
    expect(labels.some((l) => ['E5', 'D5', 'F5', 'C5'].includes(l))).toBe(true);
  });
});

describe('buildFogGrid', () => {
  it('renders misses and hits', () => {
    const grid = buildFogGrid([
      { coord: { row: 0, col: 0 }, result: { kind: 'miss' } },
      { coord: { row: 1, col: 1 }, result: { kind: 'hit', shipName: 'X' } },
    ]);
    expect(grid).toContain('O');
    expect(grid).toContain('X');
  });
});
