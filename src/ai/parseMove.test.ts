import { describe, expect, it } from 'vitest';
import { parseAiResponse, validateAiMove } from './parseMove.ts';
import { ShotBoard } from '../model/board.ts';

describe('parseAiResponse', () => {
  it('parses target label field', () => {
    expect(
      parseAiResponse('{"target":"C4","reasoning":"center probe"}'),
    ).toEqual({
      row: 3,
      col: 2,
      reasoning: 'center probe',
    });
  });

  it('parses strict JSON move with row/col', () => {
    expect(
      parseAiResponse('{"row":3,"col":4,"reasoning":"center probe"}'),
    ).toEqual({
      row: 3,
      col: 4,
      reasoning: 'center probe',
    });
  });

  it('parses JSON wrapped in markdown fences', () => {
    expect(
      parseAiResponse(
        '```json\n{"target":"E5","reasoning":"spread search"}\n```',
      ),
    ).toEqual({
      row: 4,
      col: 4,
      reasoning: 'spread search',
    });
  });

  it('rejects wrong schema fields like opening_shot', () => {
    expect(
      parseAiResponse(
        '```json\n{"opening_shot":"desert scene"}\n```',
      ),
    ).toBeNull();
  });

  it('rejects invalid JSON', () => {
    expect(parseAiResponse('not json')).toBeNull();
  });
});

describe('validateAiMove', () => {
  it('accepts candidate targets', () => {
    const board = new ShotBoard();
    expect(
      validateAiMove({ row: 5, col: 5, reasoning: 'test' }, board, new Set(['F6'])),
    ).toBeNull();
  });

  it('rejects targets outside candidate list', () => {
    const board = new ShotBoard();
    expect(
      validateAiMove({ row: 0, col: 0, reasoning: 'test' }, board, new Set(['B2'])),
    ).toBe('Target not in candidate list');
  });

  it('rejects already-fired cells', () => {
    const board = new ShotBoard();
    board.mark({ row: 2, col: 2 }, 'miss');
    expect(
      validateAiMove({ row: 2, col: 2, reasoning: 'repeat' }, board),
    ).toBe('Cell already fired upon');
  });
});
