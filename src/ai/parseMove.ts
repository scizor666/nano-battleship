import { ShotBoard } from '../model/board.ts';
import { labelToCoord } from '../utils/coordinates.ts';
import type { AiMove } from '../types/game.ts';

export function extractJsonText(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

function parseTargetField(target: unknown): { row: number; col: number } | null {
  if (typeof target !== 'string') return null;
  return labelToCoord(target);
}

export function parseAiResponse(raw: string): AiMove | null {
  try {
    const parsed = JSON.parse(extractJsonText(raw)) as {
      target?: unknown;
      row?: unknown;
      col?: unknown;
      reasoning?: unknown;
    };

    if (typeof parsed.reasoning !== 'string') return null;

    const fromTarget = parseTargetField(parsed.target);
    if (fromTarget) {
      return {
        row: fromTarget.row,
        col: fromTarget.col,
        reasoning: parsed.reasoning,
      };
    }

    if (
      typeof parsed.row === 'number' &&
      typeof parsed.col === 'number' &&
      Number.isInteger(parsed.row) &&
      Number.isInteger(parsed.col)
    ) {
      return {
        row: parsed.row,
        col: parsed.col,
        reasoning: parsed.reasoning,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function validateAiMove(
  move: AiMove,
  board: ShotBoard,
  allowedCandidates?: Set<string>,
): string | null {
  const label = `${String.fromCharCode(65 + move.col)}${move.row + 1}`;
  if (allowedCandidates && !allowedCandidates.has(label.toUpperCase())) {
    return 'Target not in candidate list';
  }
  if (board.hasBeenFired({ row: move.row, col: move.col })) {
    return 'Cell already fired upon';
  }
  return null;
}
