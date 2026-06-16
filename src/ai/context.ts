import { ShotBoard } from '../model/board.ts';
import {
  createHuntTargetState,
  huntTargetAfterShot,
  huntTargetChooseMove,
} from '../bots/huntTarget.ts';
import {
  coordKey,
  coordToLabel,
  inBounds,
  orthogonalNeighbors,
  shuffle,
} from '../utils/coordinates.ts';
import type { BotShotRecord, Coordinate } from '../types/game.ts';

export type TacticalMode = 'hunt' | 'target';

export interface TacticalContext {
  mode: TacticalMode;
  candidates: Coordinate[];
  primary: Coordinate;
  forbidden: string[];
  grid: string;
}

function huntStateFromHistory(history: BotShotRecord[]) {
  let state = createHuntTargetState();
  for (const record of history) {
    state = huntTargetAfterShot(state, record);
  }
  return state;
}

function unresolvedHitCoords(history: BotShotRecord[]): Coordinate[] {
  const hits = new Map<string, Coordinate>();
  for (const record of history) {
    const key = coordKey(record.coord);
    if (record.result.kind === 'hit') {
      hits.set(key, record.coord);
    }
    if (record.result.kind === 'sunk') {
      hits.delete(key);
    }
  }
  return [...hits.values()];
}

function parityCells(board: ShotBoard, step: number): Coordinate[] {
  return board.untouchedCells().filter((c) => (c.row + c.col) % step === 0);
}

function targetModeCandidates(
  board: ShotBoard,
  history: BotShotRecord[],
): Coordinate[] {
  const candidates: Coordinate[] = [];
  const hits = unresolvedHitCoords(history);

  for (const hit of hits) {
    for (const neighbor of orthogonalNeighbors(hit)) {
      if (!board.hasBeenFired(neighbor)) {
        candidates.push(neighbor);
      }
    }
  }

  if (hits.length >= 2) {
    const sameRow = hits.every((h) => h.row === hits[0]!.row);
    const sameCol = hits.every((h) => h.col === hits[0]!.col);
    if (sameRow || sameCol) {
      const sorted = [...hits].sort((a, b) =>
        sameRow ? a.col - b.col : a.row - b.row,
      );
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const extensions = sameRow
        ? [
            { row: first.row, col: first.col - 1 },
            { row: last.row, col: last.col + 1 },
          ]
        : [
            { row: first.row - 1, col: first.col },
            { row: last.row + 1, col: last.col },
          ];
      for (const cell of extensions) {
        if (inBounds(cell) && !board.hasBeenFired(cell)) {
          candidates.push(cell);
        }
      }
    }
  }

  return candidates;
}

function dedupeCells(cells: Coordinate[]): Coordinate[] {
  const seen = new Set<string>();
  const result: Coordinate[] = [];
  for (const cell of cells) {
    const key = coordKey(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cell);
  }
  return result;
}

export function buildTacticalCandidates(
  board: ShotBoard,
  history: BotShotRecord[],
  remainingShipSizes: number[],
): TacticalContext {
  const huntState = huntStateFromHistory(history);
  const primary = huntTargetChooseMove(
    board,
    history,
    remainingShipSizes,
    huntState,
  ).coord;

  const unresolved = unresolvedHitCoords(history);
  const mode: TacticalMode = unresolved.length > 0 ? 'target' : 'hunt';

  const pool: Coordinate[] = [primary];
  if (mode === 'target') {
    pool.push(...targetModeCandidates(board, history));
  } else {
    const step = remainingShipSizes.length
      ? Math.min(...remainingShipSizes)
      : 2;
    pool.push(...shuffle(parityCells(board, step)).slice(0, 8));
    pool.push(...shuffle(board.untouchedCells()).slice(0, 4));
  }

  let candidates = dedupeCells(pool.filter((c) => !board.hasBeenFired(c)));
  if (candidates.length === 0) {
    candidates = board.untouchedCells().slice(0, 1);
  }
  if (candidates.length > 16) {
    const rest = candidates.filter((c) => coordKey(c) !== coordKey(primary));
    candidates = [primary, ...rest.slice(0, 15)];
  }

  return {
    mode,
    primary,
    candidates,
    forbidden: history.map((r) => coordToLabel(r.coord)),
    grid: buildFogGrid(history),
  };
}

export function buildFogGrid(history: BotShotRecord[]): string {
  const cells = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => '.'));

  for (const record of history) {
    const { row, col } = record.coord;
    if (record.result.kind === 'miss') {
      cells[row]![col] = 'O';
    } else if (record.result.kind === 'hit') {
      cells[row]![col] = 'X';
    } else {
      cells[row]![col] = '#';
    }
  }

  const header = `   ${'ABCDEFGHIJ'.split('').join(' ')}`;
  const rows = cells.map((row, index) => {
    const num = String(index + 1).padStart(2, ' ');
    return `${num} ${row.join(' ')}`;
  });
  return [header, ...rows, '', 'Legend: .=unknown O=miss X=hit #=sunk'].join('\n');
}

export function candidateLabels(candidates: Coordinate[]): string[] {
  return candidates.map((c) => coordToLabel(c));
}
