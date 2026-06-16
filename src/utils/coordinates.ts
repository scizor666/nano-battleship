import type { Coordinate } from '../types/game.ts';

const COL_LABELS = 'ABCDEFGHIJ';

export function coordKey(coord: Coordinate): string {
  return `${coord.row},${coord.col}`;
}

export function parseCoordKey(key: string): Coordinate {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

export function coordToLabel(coord: Coordinate): string {
  return `${COL_LABELS[coord.col]}${coord.row + 1}`;
}

export function labelToCoord(label: string): Coordinate | null {
  const match = /^([A-J])([1-9]|10)$/i.exec(label.trim().toUpperCase());
  if (!match) return null;
  return {
    col: COL_LABELS.indexOf(match[1]),
    row: Number(match[2]) - 1,
  };
}

export function inBounds(coord: Coordinate): boolean {
  return (
    coord.row >= 0 &&
    coord.row < 10 &&
    coord.col >= 0 &&
    coord.col < 10
  );
}

export function orthogonalNeighbors(coord: Coordinate): Coordinate[] {
  const deltas = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  return deltas
    .map((d) => ({ row: coord.row + d.row, col: coord.col + d.col }))
    .filter(inBounds);
}

export function cellsForShip(
  anchor: Coordinate,
  length: number,
  orientation: import('../types/game.ts').Orientation,
): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let i = 0; i < length; i += 1) {
    cells.push({
      row: orientation === 'vertical' ? anchor.row + i : anchor.row,
      col: orientation === 'horizontal' ? anchor.col + i : anchor.col,
    });
  }
  return cells;
}

export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
