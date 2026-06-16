import { BOARD_SIZE } from './constants.ts';
import { coordKey } from '../utils/coordinates.ts';
import type { CellShotState, Coordinate } from '../types/game.ts';

export class ShotBoard {
  readonly size = BOARD_SIZE;
  private readonly shots = new Map<string, CellShotState>();

  hasBeenFired(coord: Coordinate): boolean {
    return this.shots.has(coordKey(coord));
  }

  getState(coord: Coordinate): CellShotState {
    return this.shots.get(coordKey(coord)) ?? 'untouched';
  }

  mark(coord: Coordinate, state: Exclude<CellShotState, 'untouched'>): void {
    this.shots.set(coordKey(coord), state);
  }

  firedCells(): Coordinate[] {
    return [...this.shots.keys()].map((key) => {
      const [row, col] = key.split(',').map(Number);
      return { row: row!, col: col! };
    });
  }

  untouchedCells(): Coordinate[] {
    const cells: Coordinate[] = [];
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const coord = { row, col };
        if (!this.hasBeenFired(coord)) cells.push(coord);
      }
    }
    return cells;
  }

  clone(): ShotBoard {
    const copy = new ShotBoard();
    for (const [key, state] of this.shots) {
      copy.shots.set(key, state);
    }
    return copy;
  }
}
