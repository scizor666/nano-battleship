import { FLEET_SPECS } from './constants.ts';
import { ShotBoard } from './board.ts';
import {
  allShipsSunk,
  findShipAt,
  isShipSunk,
  randomizeFleet,
  shipCells,
} from './fleet.ts';
import { coordKey } from '../utils/coordinates.ts';
import type {
  BotShotRecord,
  GamePhase,
  OpponentType,
  Ship,
  ShotResult,
  SideStats,
  TurnOwner,
} from '../types/game.ts';

export interface GameEngineState {
  phase: GamePhase;
  opponentType: OpponentType;
  playerShips: Ship[];
  opponentShips: Ship[];
  playerView: ShotBoard;
  opponentView: ShotBoard;
  turn: TurnOwner;
  winner: TurnOwner | null;
  lastResult: ShotResult | null;
  playerStats: SideStats;
  opponentStats: SideStats;
  opponentShotHistory: BotShotRecord[];
}

export function createInitialState(opponentType: OpponentType): GameEngineState {
  return {
    phase: 'setup',
    opponentType,
    playerShips: [],
    opponentShips: [],
    playerView: new ShotBoard(),
    opponentView: new ShotBoard(),
    turn: 'player',
    winner: null,
    lastResult: null,
    playerStats: { shots: 0, hits: 0, turns: 0 },
    opponentStats: { shots: 0, hits: 0, turns: 0 },
    opponentShotHistory: [],
  };
}

export function startMatch(state: GameEngineState): GameEngineState {
  const opponentShips = randomizeFleet();
  const firstTurn: TurnOwner = Math.random() < 0.5 ? 'player' : 'opponent';
  return {
    ...state,
    phase: 'playing',
    opponentShips,
    turn: firstTurn,
    winner: null,
    lastResult: null,
    playerView: new ShotBoard(),
    opponentView: new ShotBoard(),
    playerStats: { shots: 0, hits: 0, turns: firstTurn === 'player' ? 1 : 0 },
    opponentStats: { shots: 0, hits: 0, turns: firstTurn === 'opponent' ? 1 : 0 },
    opponentShotHistory: [],
  };
}

function applyShot(
  targetShips: Ship[],
  coord: { row: number; col: number },
): { ships: Ship[]; result: ShotResult } {
  const ship = findShipAt(targetShips, coord);
  if (!ship) {
    return { ships: targetShips, result: { kind: 'miss' } };
  }

  const key = coordKey(coord);
  const updatedShips = targetShips.map((s) => {
    if (s.spec.id !== ship.spec.id) return s;
    const hits = new Set(s.hits);
    hits.add(key);
    return { ...s, hits };
  });

  const updatedShip = updatedShips.find((s) => s.spec.id === ship.spec.id)!;
  if (isShipSunk(updatedShip)) {
    return {
      ships: updatedShips,
      result: {
        kind: 'sunk',
        shipName: updatedShip.spec.name,
        shipLength: updatedShip.spec.length,
      },
    };
  }

  return {
    ships: updatedShips,
    result: { kind: 'hit', shipName: ship.spec.name },
  };
}

export function allPlayerShipsPlaced(ships: Ship[]): boolean {
  return FLEET_SPECS.every((spec) => ships.some((s) => s.spec.id === spec.id));
}

export interface PlayerFireOutcome {
  state: GameEngineState;
  result: ShotResult;
  continuesTurn: boolean;
}

export function playerFire(
  state: GameEngineState,
  coord: { row: number; col: number },
): PlayerFireOutcome | null {
  if (state.phase !== 'playing' || state.turn !== 'player') return null;
  if (state.playerView.hasBeenFired(coord)) return null;

  const { ships, result } = applyShot(state.opponentShips, coord);
  const playerView = state.playerView.clone();
  playerView.mark(
    coord,
    result.kind === 'miss' ? 'miss' : 'hit',
  );

  const playerStats = {
    ...state.playerStats,
    shots: state.playerStats.shots + 1,
    hits: state.playerStats.hits + (result.kind === 'miss' ? 0 : 1),
  };

  const winner = allShipsSunk(ships) ? 'player' : null;
  const continuesTurn = result.kind !== 'miss' && !winner;

  return {
    result,
    continuesTurn,
    state: {
      ...state,
      opponentShips: ships,
      playerView,
      playerStats,
      lastResult: result,
      turn: continuesTurn ? 'player' : 'opponent',
      winner,
      phase: winner ? 'finished' : state.phase,
      opponentStats: continuesTurn
        ? state.opponentStats
        : { ...state.opponentStats, turns: state.opponentStats.turns + 1 },
    },
  };
}

export interface OpponentFireOutcome {
  state: GameEngineState;
  result: ShotResult;
  continuesTurn: boolean;
}

export function opponentFire(
  state: GameEngineState,
  coord: { row: number; col: number },
): OpponentFireOutcome | null {
  if (state.phase !== 'playing' || state.turn !== 'opponent') return null;
  if (state.opponentView.hasBeenFired(coord)) return null;

  const { ships, result } = applyShot(state.playerShips, coord);
  const opponentView = state.opponentView.clone();
  opponentView.mark(
    coord,
    result.kind === 'miss' ? 'miss' : 'hit',
  );

  const opponentStats = {
    ...state.opponentStats,
    shots: state.opponentStats.shots + 1,
    hits: state.opponentStats.hits + (result.kind === 'miss' ? 0 : 1),
  };

  const record: BotShotRecord = { coord, result };
  const opponentShotHistory = [...state.opponentShotHistory, record];
  const winner = allShipsSunk(ships) ? 'opponent' : null;
  const continuesTurn = result.kind !== 'miss' && !winner;

  return {
    result,
    continuesTurn,
    state: {
      ...state,
      playerShips: ships,
      opponentView,
      opponentStats,
      opponentShotHistory,
      lastResult: result,
      turn: continuesTurn ? 'opponent' : 'player',
      winner,
      phase: winner ? 'finished' : state.phase,
      playerStats: continuesTurn
        ? state.playerStats
        : { ...state.playerStats, turns: state.playerStats.turns + 1 },
    },
  };
}

export function getSunkShipCells(ships: Ship[]): Set<string> {
  const sunk = new Set<string>();
  for (const ship of ships) {
    if (isShipSunk(ship)) {
      for (const cell of shipCells(ship)) {
        sunk.add(coordKey(cell));
      }
    }
  }
  return sunk;
}

export function accuracy(stats: SideStats): number {
  if (stats.shots === 0) return 0;
  return Math.round((stats.hits / stats.shots) * 100);
}
