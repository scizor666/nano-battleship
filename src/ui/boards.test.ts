import { describe, expect, it } from 'vitest';
import {
  applyPreviewClasses,
  clearPreviewClasses,
  getPreviewCells,
} from './boards.ts';

describe('board preview helpers', () => {
  it('computes horizontal and vertical preview cells', () => {
    expect(getPreviewCells({ row: 2, col: 3 }, 3, 'horizontal')).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ]);
    expect(getPreviewCells({ row: 2, col: 3 }, 3, 'vertical')).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
    ]);
  });

  it('applies and clears preview classes on cells', () => {
    document.body.innerHTML = `
      <div id="board">
        <button class="board-cell" data-row="2" data-col="3"></button>
        <button class="board-cell" data-row="2" data-col="4"></button>
      </div>
    `;
    const board = document.getElementById('board')!;
    applyPreviewClasses(
      board,
      [
        { row: 2, col: 3 },
        { row: 2, col: 4 },
      ],
      true,
    );
    expect(board.querySelector('[data-row="2"][data-col="3"]')?.classList.contains('preview-valid')).toBe(true);
    clearPreviewClasses(board);
    expect(board.querySelector('.preview-valid')).toBeNull();
  });
});
