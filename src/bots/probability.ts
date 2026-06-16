import { BOARD_SIZE } from '../model/constants.ts';
import { ShotBoard } from '../model/board.ts';
import {
  cellsForShip,
  coordKey,
  inBounds,
  orthogonalNeighbors,
  parseCoordKey,
  randomChoice,
} from '../utils/coordinates.ts';
import type { BotShotRecord, Coordinate, Orientation } from '../types/game.ts';

const HIT_NEIGHBOR_BONUS = 10;

function enumeratePlacements(
  length: number,
  blocked: Set<string>,
  unresolvedHits: Set<string>,
): Coordinate[][] {
  const placements: Coordinate[][] = [];
  const orientations: Orientation[] = ['horizontal', 'vertical'];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (const orientation of orientations) {
        const anchor = { row, col };
        const cells = cellsForShip(anchor, length, orientation);
        if (cells.some((c) => !inBounds(c))) continue;
        // A placement cannot overlap a miss or a cell occupied by an already-sunk ship.
        if (cells.some((c) => blocked.has(coordKey(c)))) continue;
        // When ships are still wounded, only count placements that could explain a hit.
        if (
          unresolvedHits.size > 0 &&
          !cells.some((c) => unresolvedHits.has(coordKey(c)))
        ) {
          continue;
        }
        placements.push(cells);
      }
    }
  }

  return placements;
}

function contiguousDamagedRun(
  start: Coordinate,
  damaged: Set<string>,
  orientation: Orientation,
): Coordinate[] {
  const step =
    orientation === 'horizontal' ? { row: 0, col: 1 } : { row: 1, col: 0 };
  const run: Coordinate[] = [start];

  for (let dir = -1; dir <= 1; dir += 2) {
    let cell = { row: start.row + step.row * dir, col: start.col + step.col * dir };
    while (inBounds(cell) && damaged.has(coordKey(cell))) {
      run.push(cell);
      cell = { row: cell.row + step.row * dir, col: cell.col + step.col * dir };
    }
  }

  return run;
}

/**
 * Reconstructs the cells occupied by ships that have already been sunk. Because
 * ships are never allowed to touch (not even diagonally), a sunk ship's cells
 * are exactly the contiguous run of damaged cells through the sinking shot.
 */
function sunkShipCells(history: BotShotRecord[]): Set<string> {
  const damaged = new Set<string>();
  for (const record of history) {
    if (record.result.kind === 'hit' || record.result.kind === 'sunk') {
      damaged.add(coordKey(record.coord));
    }
  }

  const sunk = new Set<string>();
  for (const record of history) {
    if (record.result.kind !== 'sunk') continue;
    const horizontal = contiguousDamagedRun(record.coord, damaged, 'horizontal');
    const vertical = contiguousDamagedRun(record.coord, damaged, 'vertical');
    const run = horizontal.length >= vertical.length ? horizontal : vertical;
    for (const cell of run) sunk.add(coordKey(cell));
  }

  return sunk;
}

export function probabilityChooseMove(
  board: ShotBoard,
  history: BotShotRecord[],
  remainingShipSizes: number[],
): Coordinate {
  const misses = new Set<string>();
  const damaged = new Set<string>();

  for (const record of history) {
    const key = coordKey(record.coord);
    if (record.result.kind === 'miss') {
      misses.add(key);
    } else {
      damaged.add(key);
    }
  }

  const sunk = sunkShipCells(history);
  // Cells no surviving ship can occupy: our misses plus every sunk ship's hull.
  const blocked = new Set<string>([...misses, ...sunk]);
  // Hits that don't yet belong to a sunk ship — these are the wounded ships to finish.
  const unresolvedHits = new Set<string>(
    [...damaged].filter((key) => !sunk.has(key)),
  );

  const scores = new Map<string, number>();

  for (const length of remainingShipSizes) {
    const placements = enumeratePlacements(length, blocked, unresolvedHits);
    for (const placement of placements) {
      for (const cell of placement) {
        if (board.hasBeenFired(cell)) continue;
        const key = coordKey(cell);
        scores.set(key, (scores.get(key) ?? 0) + 1);
      }
    }
  }

  for (const hitKey of unresolvedHits) {
    const hit = parseCoordKey(hitKey);
    for (const neighbor of orthogonalNeighbors(hit)) {
      if (board.hasBeenFired(neighbor)) continue;
      const key = coordKey(neighbor);
      scores.set(key, (scores.get(key) ?? 0) + HIT_NEIGHBOR_BONUS);
    }
  }

  let bestScore = -1;
  const best: Coordinate[] = [];
  for (const cell of board.untouchedCells()) {
    const score = scores.get(coordKey(cell)) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best.length = 0;
      best.push(cell);
    } else if (score === bestScore) {
      best.push(cell);
    }
  }

  if (best.length === 0) return randomChoice(board.untouchedCells());
  return randomChoice(best);
}
