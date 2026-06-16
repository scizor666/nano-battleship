import {
  FRESH_SESSION_AFTER_CONSECUTIVE_INVALID,
  MAX_ATTEMPTS_PER_MOVE,
} from '../model/constants.ts';
import { remainingShipSizes } from '../model/fleet.ts';
import { huntTargetChooseMove, createHuntTargetState, huntTargetAfterShot } from '../bots/huntTarget.ts';
import { ShotBoard } from '../model/board.ts';
import { coordToLabel } from '../utils/coordinates.ts';
import { parseAiResponse, validateAiMove } from './parseMove.ts';
import { buildPromptOptions, buildTurnPrompt } from './moveSchema.ts';
import { buildTacticalCandidates } from './context.ts';
import {
  buildSystemPrompt,
  createMatchSession,
  ensureModelReady,
} from './availability.ts';
import { debugLogger } from './debugLogger.ts';
import type {
  AiMove,
  BotShotRecord,
  Ship,
  TranscriptEntry,
} from '../types/game.ts';

export interface AiOpponentCallbacks {
  onTranscript: (entry: TranscriptEntry) => void;
  onThinking: (thinking: boolean) => void;
}

export class AiNanoOpponent {
  private session: Awaited<
    ReturnType<NonNullable<typeof LanguageModel>['create']>
  > | null = null;

  private readonly callbacks: AiOpponentCallbacks;

  constructor(callbacks: AiOpponentCallbacks) {
    this.callbacks = callbacks;
  }

  async prepare(onProgress?: (n: number) => void): Promise<void> {
    await ensureModelReady(onProgress);
  }

  async startMatch(_playerShips: Ship[]): Promise<void> {
    this.session?.destroy();
    this.session = await createMatchSession([5, 4, 3, 3, 2], []);
    debugLogger.log('session', 'Match AI session created');
  }

  endMatch(): void {
    this.session?.destroy();
    this.session = null;
  }

  private addTranscript(kind: TranscriptEntry['kind'], text: string): void {
    this.callbacks.onTranscript({
      id: crypto.randomUUID(),
      kind,
      text,
      timestamp: Date.now(),
    });
  }

  private async freshSession(
    playerShips: Ship[],
    history: BotShotRecord[],
  ): Promise<void> {
    this.session?.destroy();
    const sizes = remainingShipSizes(playerShips);
    this.session = await createMatchSession(sizes, history);
    debugLogger.warn('session', 'Fresh AI session started', {
      historySize: history.length,
    });
    this.addTranscript(
      'ai-event',
      `AI session restarted with ${history.length} prior shots in context.`,
    );
  }

  async chooseMove(
    board: ShotBoard,
    playerShips: Ship[],
    history: BotShotRecord[],
    lastResult: BotShotRecord | null,
  ): Promise<AiMove> {
    if (!this.session) {
      await this.startMatch(playerShips);
    }

    const sizes = remainingShipSizes(playerShips);
    const tactical = buildTacticalCandidates(board, history, sizes);
    const allowed = new Set(
      tactical.candidates.map((c) => coordToLabel(c).toUpperCase()),
    );
    const promptOptions = buildPromptOptions(tactical.candidates);

    this.callbacks.onThinking(true);
    let attempts = 0;
    let consecutiveInvalid = 0;
    let lastInvalidTarget: string | undefined;

    try {
      while (attempts < MAX_ATTEMPTS_PER_MOVE) {
        attempts += 1;
        const prompt = buildTurnPrompt(
          tactical,
          lastResult,
          history,
          attempts,
          lastInvalidTarget,
        );

        debugLogger.log('prompt', 'Sending AI prompt', {
          prompt,
          candidates: [...allowed],
        });

        let raw: string;
        try {
          raw = await this.session!.prompt(prompt, promptOptions);
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'InvalidStateError'
          ) {
            debugLogger.warn('session', 'Session destroyed; recreating', error);
            await this.freshSession(playerShips, history);
            raw = await this.session!.prompt(prompt, promptOptions);
          } else {
            throw error;
          }
        }
        debugLogger.log('response', 'Raw AI response', raw);

        const parsed = parseAiResponse(raw);
        if (!parsed) {
          consecutiveInvalid += 1;
          debugLogger.warn('validation', 'Invalid JSON from model', raw);
          this.addTranscript('ai-event', `Retry ${attempts}: invalid response format.`);
        } else {
          const error = validateAiMove(parsed, board, allowed);
          if (error) {
            consecutiveInvalid += 1;
            lastInvalidTarget = coordToLabel({ row: parsed.row, col: parsed.col });
            debugLogger.warn('validation', error, parsed);
            this.addTranscript(
              'ai-event',
              `Retry ${attempts}: ${error} (${lastInvalidTarget}).`,
            );
          } else {
            this.addTranscript(
              'ai-move',
              `${coordToLabel({ row: parsed.row, col: parsed.col })} — ${parsed.reasoning}`,
            );
            return parsed;
          }
        }

        if (consecutiveInvalid >= FRESH_SESSION_AFTER_CONSECUTIVE_INVALID) {
          await this.freshSession(playerShips, history);
          consecutiveInvalid = 0;
        }
      }

      let huntState = createHuntTargetState();
      for (const record of history) {
        huntState = huntTargetAfterShot(huntState, record);
      }
      const fallback = huntTargetChooseMove(
        board,
        history,
        sizes,
        huntState,
      ).coord;
      debugLogger.warn('fallback', 'Using Hunt/Target fallback', fallback);
      this.addTranscript(
        'ai-event',
        `Fallback move used at ${coordToLabel(fallback)} after ${MAX_ATTEMPTS_PER_MOVE} failed attempts.`,
      );
      return {
        row: fallback.row,
        col: fallback.col,
        reasoning: 'Fallback: Hunt/Target algorithm',
        fromFallback: true,
      };
    } finally {
      this.callbacks.onThinking(false);
    }
  }
}

export function getAiSystemPromptPreview(sizes: number[]): string {
  return buildSystemPrompt(sizes);
}
