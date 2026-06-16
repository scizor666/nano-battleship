import { FLEET_SPECS } from './constants.ts';
import {
  cellsForShip,
  coordKey,
  inBounds,
  randomChoice,
  shuffle,
} from '../utils/coordinates.ts';
import type {
  Coordinate,
  Orientation,
  Ship,
  ShipSpec,
} from '../types/game.ts';

export function createShip(
  spec: ShipSpec,
  anchor: Coordinate,
  orientation: Orientation,
): Ship {
  return { spec, anchor, orientation, hits: new Set() };
}

export function shipCells(ship: Ship): Coordinate[] {
  return cellsForShip(ship.anchor, ship.spec.length, ship.orientation);
}

export function isShipSunk(ship: Ship): boolean {
  return ship.hits.size >= ship.spec.length;
}

function allOccupiedCells(ships: Ship[]): Set<string> {
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const cell of shipCells(ship)) {
      occupied.add(coordKey(cell));
    }
  }
  return occupied;
}

function adjacentCells(cells: Coordinate[]): Coordinate[] {
  const seen = new Set<string>();
  const result: Coordinate[] = [];
  const deltas = [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];
  for (const cell of cells) {
    for (const d of deltas) {
      const next = { row: cell.row + d.row, col: cell.col + d.col };
      if (!inBounds(next)) continue;
      const key = coordKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(next);
    }
  }
  return result;
}

export function canPlaceShip(
  ships: Ship[],
  spec: ShipSpec,
  anchor: Coordinate,
  orientation: Orientation,
  ignoreShipId?: string,
): boolean {
  const cells = cellsForShip(anchor, spec.length, orientation);
  if (cells.some((c) => !inBounds(c))) return false;

  const others = ignoreShipId
    ? ships.filter((s) => s.spec.id !== ignoreShipId)
    : ships;
  const occupied = allOccupiedCells(others);
  const forbidden = new Set<string>();
  for (const ship of others) {
    for (const adj of adjacentCells(shipCells(ship))) {
      forbidden.add(coordKey(adj));
    }
  }

  for (const cell of cells) {
    const key = coordKey(cell);
    if (occupied.has(key) || forbidden.has(key)) return false;
  }
  return true;
}

export function placeShip(
  ships: Ship[],
  spec: ShipSpec,
  anchor: Coordinate,
  orientation: Orientation,
): Ship[] {
  if (!canPlaceShip(ships, spec, anchor, orientation)) {
    throw new Error('Illegal ship placement');
  }
  return [...ships.filter((s) => s.spec.id !== spec.id), createShip(spec, anchor, orientation)];
}

export function removeShip(ships: Ship[], shipId: string): Ship[] {
  return ships.filter((s) => s.spec.id !== shipId);
}

export function randomizeFleet(): Ship[] {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const specs = shuffle([...FLEET_SPECS]);
    let placed: Ship[] = [];
    let failed = false;
    for (const spec of specs) {
      let placedSpec = false;
      for (let tryPlace = 0; tryPlace < 500 && !placedSpec; tryPlace += 1) {
        const orientation: Orientation =
          Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const anchor: Coordinate = {
          row: Math.floor(Math.random() * 10),
          col: Math.floor(Math.random() * 10),
        };
        if (canPlaceShip(placed, spec, anchor, orientation)) {
          placed = placeShip(placed, spec, anchor, orientation);
          placedSpec = true;
        }
      }
      if (!placedSpec) {
        failed = true;
        break;
      }
    }
    if (!failed) return placed;
  }
  throw new Error('Failed to randomize fleet after many attempts');
}

export function remainingShipSizes(ships: Ship[]): number[] {
  return ships.filter((s) => !isShipSunk(s)).map((s) => s.spec.length);
}

export function smallestRemainingShipSize(ships: Ship[]): number {
  const sizes = remainingShipSizes(ships);
  return sizes.length ? Math.min(...sizes) : 2;
}

export function findShipAt(ships: Ship[], coord: Coordinate): Ship | undefined {
  const key = coordKey(coord);
  return ships.find((ship) => shipCells(ship).some((c) => coordKey(c) === key));
}

export function allShipsSunk(ships: Ship[]): boolean {
  return ships.every(isShipSunk);
}

export function randomLegalCell(candidates: Coordinate[]): Coordinate {
  return randomChoice(candidates);
}
