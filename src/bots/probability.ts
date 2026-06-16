import { BOARD_SIZE } from '../model/constants.ts';
import { ShotBoard } from '../model/board.ts';
import {
  cellsForShip,
  coordKey,
  inBounds,
  orthogonalNeighbors,
  randomChoice,
} from '../utils/coordinates.ts';
import type { BotShotRecord, Coordinate, Orientation } from '../types/game.ts';

function enumeratePlacements(
  length: number,
  misses: Set<string>,
  hits: Set<string>,
): Coordinate[][] {
  const placements: Coordinate[][] = [];
  const orientations: Orientation[] = ['horizontal', 'vertical'];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (const orientation of orientations) {
        const anchor = { row, col };
        const cells = cellsForShip(anchor, length, orientation);
        if (cells.some((c) => !inBounds(c))) continue;
        if (cells.some((c) => misses.has(coordKey(c)))) continue;
        if (hits.size > 0 && !cells.some((c) => hits.has(coordKey(c)))) continue;
        placements.push(cells);
      }
    }
  }

  return placements;
}

export function probabilityChooseMove(
  board: ShotBoard,
  history: BotShotRecord[],
  remainingShipSizes: number[],
): Coordinate {
  const misses = new Set<string>();
  const unresolvedHits = new Set<string>();

  for (const record of history) {
    const key = coordKey(record.coord);
    if (record.result.kind === 'miss') misses.add(key);
    if (record.result.kind === 'hit') unresolvedHits.add(key);
    if (record.result.kind === 'sunk') unresolvedHits.delete(key);
  }

  const scores = new Map<string, number>();
  const untouched = board.untouchedCells();

  for (const length of remainingShipSizes) {
    const placements = enumeratePlacements(length, misses, unresolvedHits);
    for (const placement of placements) {
      for (const cell of placement) {
        const key = coordKey(cell);
        if (board.hasBeenFired(cell)) continue;
        scores.set(key, (scores.get(key) ?? 0) + 1);
      }
    }
  }

  for (const hitKey of unresolvedHits) {
    const hit = hitKey.split(',').map(Number);
    const hitCoord = { row: hit[0]!, col: hit[1]! };
    for (const neighbor of orthogonalNeighbors(hitCoord)) {
      const key = coordKey(neighbor);
      if (!board.hasBeenFired(neighbor)) {
        scores.set(key, (scores.get(key) ?? 0) + 10);
      }
    }
  }

  let bestScore = -1;
  const best: Coordinate[] = [];
  for (const cell of untouched) {
    const score = scores.get(coordKey(cell)) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best.length = 0;
      best.push(cell);
    } else if (score === bestScore) {
      best.push(cell);
    }
  }

  if (best.length === 0) return randomChoice(untouched);
  return randomChoice(best);
}
