import { coordToLabel } from '../utils/coordinates.ts';
import type { BotShotRecord, Coordinate } from '../types/game.ts';
import type { TacticalContext } from './context.ts';

export function buildMoveResponseSchema(candidates: Coordinate[]) {
  const labels = candidates.map((c) => coordToLabel(c));
  return {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: labels,
      },
      reasoning: { type: 'string' },
    },
    required: ['target', 'reasoning'],
  };
}

export function buildPromptOptions(candidates: Coordinate[]) {
  return {
    responseConstraint: buildMoveResponseSchema(candidates),
  };
}

export function buildTurnPrompt(
  context: TacticalContext,
  lastResult: BotShotRecord | null,
  history: BotShotRecord[],
  attempt: number,
  lastInvalidTarget?: string,
): string {
  const candidateList = context.candidates.map((c) => coordToLabel(c)).join(', ');
  const lines = [
    'Battleship turn. Pick exactly ONE target cell from the candidate list.',
    `Mode: ${context.mode.toUpperCase()} (${context.mode === 'target' ? 'finish damaged ships first' : 'search with checkerboard spacing'})`,
    '',
    'Known board (your shots only):',
    context.grid,
    '',
  ];

  if (context.forbidden.length > 0) {
    lines.push(`Already attacked (FORBIDDEN): ${context.forbidden.join(', ')}`);
    lines.push('');
  }

  lines.push(`Candidate targets (pick ONE): ${candidateList}`);
  lines.push(`Recommended: ${coordToLabel(context.primary)}`);

  if (lastResult && history.length > 0) {
    const label = coordToLabel(lastResult.coord);
    if (lastResult.result.kind === 'miss') {
      lines.push(`Last result: ${label} was MISS.`);
    } else if (lastResult.result.kind === 'hit') {
      lines.push(`Last result: ${label} was HIT — keep attacking adjacent/in-line cells.`);
    } else {
      lines.push(
        `Last result: ${label} SUNK ${lastResult.result.shipName}. Resume search.`,
      );
    }
  }

  if (attempt > 1) {
    lines.push(
      `Retry ${attempt}: previous answer was invalid${lastInvalidTarget ? ` (${lastInvalidTarget})` : ''}.`,
    );
    lines.push('Return JSON with "target" copied exactly from Candidate targets and "reasoning".');
  }

  return lines.join('\n');
}
