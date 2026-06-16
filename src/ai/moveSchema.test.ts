import { describe, expect, it } from 'vitest';
import { buildTurnPrompt, buildMoveResponseSchema } from './moveSchema.ts';
import { buildTacticalCandidates } from './context.ts';
import { ShotBoard } from '../model/board.ts';

describe('buildTurnPrompt', () => {
  it('includes fog grid, forbidden cells, and candidates', () => {
    const board = new ShotBoard();
    board.mark({ row: 0, col: 0 }, 'miss');
    const history = [{ coord: { row: 0, col: 0 }, result: { kind: 'miss' as const } }];
    const tactical = buildTacticalCandidates(board, history, [2]);
    const prompt = buildTurnPrompt(tactical, history[0]!, history, 1);
    expect(prompt).toContain('FORBIDDEN');
    expect(prompt).toContain('A1');
    expect(prompt).toContain('Candidate targets');
    expect(prompt.toLowerCase()).not.toContain('opening shot');
  });

  it('builds schema enum from candidates only', () => {
    const schema = buildMoveResponseSchema([
      { row: 2, col: 3 },
      { row: 4, col: 5 },
    ]);
    expect(schema.properties.target.enum).toEqual(['D3', 'F5']);
  });
});
