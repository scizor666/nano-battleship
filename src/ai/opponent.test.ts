import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShotBoard } from '../model/board.ts';
import { FLEET_SPECS } from '../model/constants.ts';
import { createShip } from '../model/fleet.ts';
import { AiNanoOpponent } from './opponent.ts';
import { MAX_ATTEMPTS_PER_MOVE } from '../model/constants.ts';

function mockSession(responses: string[]) {
  let index = 0;
  return {
    prompt: vi.fn(async (_input: string, options?: { responseConstraint?: { properties?: { target?: { enum?: string[] } } } }) => {
      expect(options?.responseConstraint?.properties?.target?.enum?.length).toBeGreaterThan(0);
      return responses[index++] ?? responses.at(-1)!;
    }),
    destroy: vi.fn(),
  };
}

describe('AiNanoOpponent', () => {
  beforeEach(() => {
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => {
        const session = mockSession(['']);
        session.prompt = vi.fn(async (_input: string, options?: { responseConstraint?: { properties?: { target?: { enum?: string[] } } } }) => {
          expect(options?.responseConstraint?.properties?.target?.enum?.length).toBeGreaterThan(0);
          const first = options?.responseConstraint?.properties?.target?.enum?.[0] ?? 'A1';
          return `{"target":"${first}","reasoning":"corner start"}`;
        });
        return session;
      }),
    });
  });

  it('returns a validated move with reasoning', async () => {
    const transcripts: string[] = [];
    const opponent = new AiNanoOpponent({
      onTranscript: (entry) => transcripts.push(entry.text),
      onThinking: () => {},
    });
    await opponent.startMatch([
      createShip(FLEET_SPECS[4]!, { row: 0, col: 0 }, 'horizontal'),
    ]);

    const move = await opponent.chooseMove(
      new ShotBoard(),
      [createShip(FLEET_SPECS[4]!, { row: 0, col: 0 }, 'horizontal')],
      [],
      null,
    );

    expect(move.reasoning).toBe('corner start');
    expect(transcripts.some((t) => t.includes('—'))).toBe(true);
  });

  it('falls back to hunt/target after max invalid attempts', async () => {
    const invalid = 'not json';
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () =>
        mockSession(Array(MAX_ATTEMPTS_PER_MOVE).fill(invalid)),
      ),
    });

    const transcripts: string[] = [];
    const opponent = new AiNanoOpponent({
      onTranscript: (entry) => transcripts.push(entry.text),
      onThinking: () => {},
    });
    await opponent.startMatch([
      createShip(FLEET_SPECS[4]!, { row: 5, col: 5 }, 'horizontal'),
    ]);

    const board = new ShotBoard();
    const move = await opponent.chooseMove(
      board,
      [createShip(FLEET_SPECS[4]!, { row: 5, col: 5 }, 'horizontal')],
      [],
      null,
    );

    expect(move.fromFallback).toBe(true);
    expect(board.hasBeenFired({ row: move.row, col: move.col })).toBe(false);
    expect(transcripts.some((t) => t.includes('Fallback move used'))).toBe(true);
  });

  it('recreates session if prompt hits a destroyed session', async () => {
    let created = 0;
    let promptCalls = 0;
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => {
        created += 1;
        return {
          prompt: vi.fn(async (_input: string, options?: { responseConstraint?: { properties?: { target?: { enum?: string[] } } } }) => {
            promptCalls += 1;
            if (promptCalls === 1) {
              throw new DOMException('Session destroyed', 'InvalidStateError');
            }
            const first = options?.responseConstraint?.properties?.target?.enum?.[0] ?? 'A1';
            return `{"target":"${first}","reasoning":"recovered"}`;
          }),
          destroy: vi.fn(),
        };
      }),
    });

    const opponent = new AiNanoOpponent({
      onTranscript: () => {},
      onThinking: () => {},
    });
    await opponent.startMatch([
      createShip(FLEET_SPECS[4]!, { row: 0, col: 0 }, 'horizontal'),
    ]);

    const move = await opponent.chooseMove(
      new ShotBoard(),
      [createShip(FLEET_SPECS[4]!, { row: 0, col: 0 }, 'horizontal')],
      [],
      null,
    );

    expect(move.reasoning).toBe('recovered');
    expect(LanguageModel!.create).toHaveBeenCalledTimes(2);
  });
});
