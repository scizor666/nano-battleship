import { describe, expect, it, vi } from 'vitest';
import { FLEET_SPECS } from './constants.ts';
import {
  accuracy,
  allPlayerShipsPlaced,
  createInitialState,
  opponentFire,
  playerFire,
  startMatch,
} from './gameEngine.ts';
import * as fleet from './fleet.ts';
import { createShip, randomizeFleet, shipCells } from './fleet.ts';

function fleetWithSingleDestroyerAt(row: number, col: number) {
  return [createShip(FLEET_SPECS[4]!, { row, col }, 'horizontal')];
}

function fleetWithCarrierAt(row: number, col: number) {
  return [createShip(FLEET_SPECS[0]!, { row, col }, 'horizontal')];
}

function playingState() {
  let state = createInitialState('huntTarget');
  state = {
    ...state,
    phase: 'playing',
    turn: 'player',
    playerShips: fleetWithSingleDestroyerAt(9, 0),
    opponentShips: fleetWithCarrierAt(0, 0),
    playerStats: { shots: 0, hits: 0, turns: 1 },
    opponentStats: { shots: 0, hits: 0, turns: 0 },
  };
  return state;
}

describe('gameEngine', () => {
  it('requires all five ships before start', () => {
    expect(allPlayerShipsPlaced([])).toBe(false);
    expect(allPlayerShipsPlaced(randomizeFleet())).toBe(true);
  });

  it('randomizes first turn on startMatch', () => {
    vi.spyOn(fleet, 'randomizeFleet').mockReturnValue(
      fleetWithSingleDestroyerAt(0, 0),
    );
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    const playerFirst = startMatch(createInitialState('huntTarget'));
    expect(playerFirst.turn).toBe('player');
    expect(playerFirst.playerStats.turns).toBe(1);

    random.mockReturnValue(0.9);
    const opponentFirst = startMatch(createInitialState('huntTarget'));
    expect(opponentFirst.turn).toBe('opponent');
    expect(opponentFirst.opponentStats.turns).toBe(1);
    random.mockRestore();
    vi.restoreAllMocks();
  });

  it('grants extra shot to player on hit until miss', () => {
    let state = playingState();
    const first = playerFire(state, { row: 0, col: 0 })!;
    expect(first.result.kind).toBe('hit');
    expect(first.continuesTurn).toBe(true);
    expect(first.state.turn).toBe('player');

    const second = playerFire(first.state, { row: 0, col: 1 })!;
    expect(second.result.kind).toBe('hit');
    expect(second.continuesTurn).toBe(true);

    const third = playerFire(second.state, { row: 5, col: 5 })!;
    expect(third.result.kind).toBe('miss');
    expect(third.continuesTurn).toBe(false);
    expect(third.state.turn).toBe('opponent');
  });

  it('passes turn to opponent after a miss', () => {
    let state = playingState();
    const miss = playerFire(state, { row: 5, col: 5 })!;
    expect(miss.result.kind).toBe('miss');
    expect(miss.continuesTurn).toBe(false);
    expect(miss.state.turn).toBe('opponent');
  });

  it('ends match when all opponent ships are sunk', () => {
    let state = createInitialState('huntTarget');
    state = {
      ...state,
      phase: 'playing',
      turn: 'player',
      playerShips: fleetWithSingleDestroyerAt(9, 0),
      opponentShips: fleetWithSingleDestroyerAt(0, 0),
      playerStats: { shots: 0, hits: 0, turns: 1 },
      opponentStats: { shots: 0, hits: 0, turns: 0 },
    };
    for (const cell of shipCells(state.opponentShips[0]!)) {
      const outcome = playerFire(state, cell);
      expect(outcome).not.toBeNull();
      state = outcome!.state;
    }
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('player');
  });

  it('prevents firing the same cell twice', () => {
    const state = playingState();
    const first = playerFire(state, { row: 9, col: 9 });
    expect(first?.result.kind).toBe('miss');
    expect(playerFire(first!.state, { row: 9, col: 9 })).toBeNull();
  });

  it('records opponent shot history', () => {
    let state = createInitialState('huntTarget');
    state = {
      ...state,
      phase: 'playing',
      turn: 'opponent',
      playerShips: fleetWithSingleDestroyerAt(4, 4),
      opponentShips: fleetWithSingleDestroyerAt(0, 0),
      opponentStats: { shots: 0, hits: 0, turns: 1 },
    };
    const outcome = opponentFire(state, { row: 0, col: 0 })!;
    expect(outcome.state.opponentShotHistory).toHaveLength(1);
    expect(outcome.state.opponentShotHistory[0]!.result.kind).toBe('miss');
  });

  it('computes accuracy', () => {
    expect(accuracy({ shots: 0, hits: 0, turns: 1 })).toBe(0);
    expect(accuracy({ shots: 4, hits: 2, turns: 2 })).toBe(50);
  });
});
