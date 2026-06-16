import { describe, expect, it } from 'vitest';
import { FLEET_SPECS } from '../model/constants.ts';
import {
  canPlaceShip,
  createShip,
  placeShip,
  randomizeFleet,
  shipCells,
} from '../model/fleet.ts';

describe('fleet placement', () => {
  it('allows a legal isolated ship placement', () => {
    const spec = FLEET_SPECS[4]!;
    expect(canPlaceShip([], spec, { row: 0, col: 0 }, 'horizontal')).toBe(true);
  });

  it('rejects overlapping ships', () => {
    const destroyer = FLEET_SPECS[4]!;
    const placed = [createShip(destroyer, { row: 0, col: 0 }, 'horizontal')];
    expect(canPlaceShip(placed, destroyer, { row: 0, col: 0 }, 'horizontal')).toBe(
      false,
    );
  });

  it('rejects diagonally touching ships', () => {
    const destroyer = FLEET_SPECS[4]!;
    const placed = [createShip(destroyer, { row: 0, col: 0 }, 'horizontal')];
    const other = FLEET_SPECS[3]!;
    expect(canPlaceShip(placed, other, { row: 1, col: 1 }, 'horizontal')).toBe(
      false,
    );
  });

  it('rejects ships that extend off the board', () => {
    const carrier = FLEET_SPECS[0]!;
    expect(canPlaceShip([], carrier, { row: 0, col: 8 }, 'horizontal')).toBe(
      false,
    );
  });

  it('places all five ships via randomizeFleet', () => {
    const fleet = randomizeFleet();
    expect(fleet).toHaveLength(5);
    const ids = new Set(fleet.map((s) => s.spec.id));
    expect(ids.size).toBe(5);
    for (const ship of fleet) {
      for (const cell of shipCells(ship)) {
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(10);
        expect(cell.col).toBeLessThan(10);
      }
    }
  });

  it('placeShip adds a ship when legal', () => {
    const spec = FLEET_SPECS[4]!;
    const fleet = placeShip([], spec, { row: 5, col: 5 }, 'vertical');
    expect(fleet).toHaveLength(1);
    expect(fleet[0]!.orientation).toBe('vertical');
  });
});
