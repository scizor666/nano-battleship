import { ShotBoard } from '../model/board.ts';
import {
  coordKey,
  inBounds,
  orthogonalNeighbors,
  randomChoice,
} from '../utils/coordinates.ts';
import type { BotShotRecord, Coordinate } from '../types/game.ts';

interface HuntTargetState {
  unresolvedHits: Coordinate[];
}

function parityCandidates(cells: Coordinate[], step: number): Coordinate[] {
  const filtered = cells.filter(
    (c) => (c.row + c.col) % step === 0,
  );
  return filtered.length ? filtered : cells;
}

function lineExtensionHits(hits: Coordinate[]): Coordinate[] {
  if (hits.length < 2) return [];

  const sameRow = hits.every((h) => h.row === hits[0]!.row);
  const sameCol = hits.every((h) => h.col === hits[0]!.col);
  if (!sameRow && !sameCol) return [];

  const sorted = [...hits].sort((a, b) =>
    sameRow ? a.col - b.col : a.row - b.row,
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const candidates: Coordinate[] = [];

  if (sameRow) {
    candidates.push({ row: first.row, col: first.col - 1 });
    candidates.push({ row: last.row, col: last.col + 1 });
  } else {
    candidates.push({ row: first.row - 1, col: first.col });
    candidates.push({ row: last.row + 1, col: last.col });
  }

  return candidates.filter(inBounds);
}

function pruneResolvedHits(
  hits: Coordinate[],
  history: BotShotRecord[],
): Coordinate[] {
  const sunkCells = new Set<string>();
  for (const record of history) {
    if (record.result.kind === 'sunk') {
      // Remove hits that belong to a sunk ship cluster — approximate by clearing
      // all unresolved hits adjacent to the sunk shot for simplicity.
      sunkCells.add(coordKey(record.coord));
    }
  }

  return hits.filter((hit) => {
    const sunkAtHit = history.some(
      (r) =>
        r.result.kind === 'sunk' &&
        coordKey(r.coord) === coordKey(hit),
    );
    if (sunkAtHit) return false;
    return true;
  });
}

export function createHuntTargetState(): HuntTargetState {
  return { unresolvedHits: [] };
}

export function huntTargetChooseMove(
  board: ShotBoard,
  history: BotShotRecord[],
  remainingShipSizes: number[],
  state: HuntTargetState,
): { coord: Coordinate; state: HuntTargetState } {
  const available = board.untouchedCells();
  let unresolvedHits = pruneResolvedHits(state.unresolvedHits, history);

  for (const record of history) {
    if (record.result.kind === 'hit' || record.result.kind === 'sunk') {
      if (!unresolvedHits.some((h) => coordKey(h) === coordKey(record.coord))) {
        unresolvedHits.push(record.coord);
      }
    }
    if (record.result.kind === 'sunk') {
      unresolvedHits = unresolvedHits.filter(
        (hit) => coordKey(hit) !== coordKey(record.coord),
      );
    }
  }

  if (unresolvedHits.length > 0) {
    const lineTargets = lineExtensionHits(unresolvedHits)
      .filter((c) => !board.hasBeenFired(c));
    if (lineTargets.length > 0) {
      return {
        coord: randomChoice(lineTargets),
        state: { unresolvedHits },
      };
    }

    const neighborTargets: Coordinate[] = [];
    for (const hit of unresolvedHits) {
      for (const neighbor of orthogonalNeighbors(hit)) {
        if (!board.hasBeenFired(neighbor)) {
          neighborTargets.push(neighbor);
        }
      }
    }
    if (neighborTargets.length > 0) {
      return {
        coord: randomChoice(neighborTargets),
        state: { unresolvedHits },
      };
    }
  }

  const step = remainingShipSizes.length
    ? Math.min(...remainingShipSizes)
    : 2;
  const huntPool = parityCandidates(available, step);
  return {
    coord: randomChoice(huntPool),
    state: { unresolvedHits },
  };
}

export function huntTargetAfterShot(
  state: HuntTargetState,
  record: BotShotRecord,
): HuntTargetState {
  if (record.result.kind === 'miss') return state;
  if (record.result.kind === 'sunk') {
    return {
      unresolvedHits: state.unresolvedHits.filter(
        (h) => coordKey(h) !== coordKey(record.coord),
      ),
    };
  }
  const exists = state.unresolvedHits.some(
    (h) => coordKey(h) === coordKey(record.coord),
  );
  return {
    unresolvedHits: exists
      ? state.unresolvedHits
      : [...state.unresolvedHits, record.coord],
  };
}
