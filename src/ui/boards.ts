import { BOARD_SIZE } from '../model/constants.ts';
import { coordKey, coordToLabel } from '../utils/coordinates.ts';
import type { CellShotState, Coordinate, Ship } from '../types/game.ts';
import { shipCells } from '../model/fleet.ts';

const COL_LABELS = 'ABCDEFGHIJ';

export interface BoardRenderOptions {
  id: string;
  title: string;
  interactive: boolean;
  showShips: boolean;
  ships: Ship[];
  shotBoard: import('../model/board.ts').ShotBoard;
  sunkCells?: Set<string>;
  preview?: {
    cells: Coordinate[];
    valid: boolean;
  } | null;
  focusedCell?: Coordinate | null;
  onCellClick?: (coord: Coordinate) => void;
  onCellKeydown?: (coord: Coordinate, event: KeyboardEvent) => void;
}

export function renderBoard(options: BoardRenderOptions): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'board-panel';
  wrapper.setAttribute('aria-label', options.title);

  const heading = document.createElement('h2');
  heading.className = 'board-title';
  heading.textContent = options.title;
  wrapper.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'board-grid';
  grid.setAttribute('role', 'grid');
  grid.dataset.boardId = options.id;

  const corner = document.createElement('div');
  corner.className = 'board-corner';
  grid.appendChild(corner);

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const label = document.createElement('div');
    label.className = 'board-label col-label';
    label.textContent = COL_LABELS[col]!;
    grid.appendChild(label);
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'board-label row-label';
    rowLabel.textContent = String(row + 1);
    grid.appendChild(rowLabel);

    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const coord = { row, col };
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'board-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', describeCell(coord, options));

      applyCellVisuals(cell, coord, options);

      if (options.interactive) {
        cell.tabIndex =
          options.focusedCell &&
          options.focusedCell.row === row &&
          options.focusedCell.col === col
            ? 0
            : -1;
        cell.addEventListener('click', () => options.onCellClick?.(coord));
        cell.addEventListener('keydown', (event) =>
          options.onCellKeydown?.(coord, event),
        );
      } else {
        cell.disabled = true;
      }

      grid.appendChild(cell);
    }
  }

  wrapper.appendChild(grid);
  return wrapper;
}

function describeCell(
  coord: Coordinate,
  options: BoardRenderOptions,
): string {
  const label = coordToLabel(coord);
  const shot = options.shotBoard.getState(coord);
  const ship = options.showShips
    ? options.ships.find((s) =>
        shipCells(s).some((c) => coordKey(c) === coordKey(coord)),
      )
    : undefined;
  const sunk = options.sunkCells?.has(coordKey(coord));

  const parts = [label];
  if (ship) parts.push(ship.spec.name);
  if (shot === 'miss') parts.push('miss');
  if (shot === 'hit') parts.push(sunk ? 'sunk' : 'hit');
  if (!ship && shot === 'untouched') parts.push('water');
  return parts.join(', ');
}

function applyCellVisuals(
  cell: HTMLButtonElement,
  coord: Coordinate,
  options: BoardRenderOptions,
): void {
  const key = coordKey(coord);
  const shot = options.shotBoard.getState(coord);
  cell.classList.remove('ship', 'hit', 'miss', 'sunk', 'preview-valid', 'preview-invalid', 'focused');

  if (options.focusedCell && coordKey(options.focusedCell) === key) {
    cell.classList.add('focused');
  }

  if (options.preview) {
    const inPreview = options.preview.cells.some((c) => coordKey(c) === key);
    if (inPreview) {
      cell.classList.add(
        options.preview.valid ? 'preview-valid' : 'preview-invalid',
      );
    }
  }

  if (options.showShips) {
    const occupied = options.ships.some((ship) =>
      shipCells(ship).some((c) => coordKey(c) === key),
    );
    if (occupied) cell.classList.add('ship');
  }

  if (shot === 'miss') cell.classList.add('miss');
  if (shot === 'hit') {
    cell.classList.add(options.sunkCells?.has(key) ? 'sunk' : 'hit');
  }
}

export function clearPreviewClasses(container: HTMLElement): void {
  container.querySelectorAll('.board-cell').forEach((cell) => {
    cell.classList.remove('preview-valid', 'preview-invalid');
  });
}

export function applyPreviewClasses(
  container: HTMLElement,
  cells: Coordinate[],
  valid: boolean,
): void {
  clearPreviewClasses(container);
  for (const coord of cells) {
    const cell = container.querySelector(
      `[data-row="${coord.row}"][data-col="${coord.col}"]`,
    );
    if (cell) {
      cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  }
}

export function getPreviewCells(
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

export function moveFocus(
  current: Coordinate,
  direction: 'up' | 'down' | 'left' | 'right',
): Coordinate {
  const next = { ...current };
  if (direction === 'up') next.row = Math.max(0, next.row - 1);
  if (direction === 'down') next.row = Math.min(BOARD_SIZE - 1, next.row + 1);
  if (direction === 'left') next.col = Math.max(0, next.col - 1);
  if (direction === 'right') next.col = Math.min(BOARD_SIZE - 1, next.col + 1);
  return next;
}

export function animateCell(
  boardId: string,
  coord: Coordinate,
  className: string,
  reducedMotion: boolean,
): void {
  if (reducedMotion) return;
  const selector = `[data-board-id="${boardId}"] [data-row="${coord.row}"][data-col="${coord.col}"]`;
  const cell = document.querySelector(selector);
  if (!cell) return;
  cell.classList.add(className);
  window.setTimeout(() => cell.classList.remove(className), 500);
}

export type { CellShotState };
