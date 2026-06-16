import { AI_UNAVAILABLE_REASON } from '../model/constants.ts';
import { debugLogger } from './debugLogger.ts';
import type { AvailabilityState } from '../types/game.ts';

const AI_CREATE_OPTIONS = {
  systemPrompt: '',
};

export interface AvailabilityInfo {
  supported: boolean;
  state: AvailabilityState;
  reason: string;
  downloadProgress: number | null;
}

let modelReady = false;

export function isModelReady(): boolean {
  return modelReady;
}

export function resetModelReadyForTests(): void {
  modelReady = false;
}

export async function checkAvailability(): Promise<AvailabilityInfo> {
  if (typeof LanguageModel === 'undefined') {
    return {
      supported: false,
      state: 'unavailable',
      reason: AI_UNAVAILABLE_REASON,
      downloadProgress: null,
    };
  }

  try {
    const state = await LanguageModel.availability(AI_CREATE_OPTIONS);
    debugLogger.log('availability', `Prompt API state: ${state}`);
    return {
      supported: state !== 'unavailable',
      state,
      reason: state === 'unavailable' ? AI_UNAVAILABLE_REASON : '',
      downloadProgress: state === 'downloading' ? 0 : null,
    };
  } catch (error) {
    debugLogger.error('availability', 'Failed to check availability', error);
    return {
      supported: false,
      state: 'unavailable',
      reason: AI_UNAVAILABLE_REASON,
      downloadProgress: null,
    };
  }
}

export type DownloadProgressCallback = (progress: number) => void;

export async function ensureModelReady(
  onProgress?: DownloadProgressCallback,
): Promise<void> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error(AI_UNAVAILABLE_REASON);
  }

  const availability = await LanguageModel.availability(AI_CREATE_OPTIONS);
  if (availability === 'unavailable') {
    throw new Error(AI_UNAVAILABLE_REASON);
  }

  if (modelReady) return;

  const warmup = await LanguageModel.create({
    ...AI_CREATE_OPTIONS,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progress = Math.round(event.loaded * 100);
        onProgress?.(progress);
        debugLogger.log('download', `Model download ${progress}%`);
      });
    },
  });

  // Warmup session only triggers the download; gameplay uses a dedicated match session.
  warmup.destroy();
  modelReady = true;
  debugLogger.log('session', 'On-device model ready');
}

export function buildSystemPrompt(remainingShipSizes: number[]): string {
  return [
    'You are the computer opponent in the board game Battleship.',
    'Each turn you choose ONE grid cell label (like C4) from the candidate list provided.',
    'Columns A-J, rows 1-10. You only know your own past attack results.',
    `Enemy ships still afloat have lengths: ${remainingShipSizes.join(', ')}.`,
    'Strategy:',
    '- HUNT mode: spread shots using checkerboard spacing; avoid repeating cells.',
    '- TARGET mode: when you have a HIT without a sink, attack adjacent and in-line cells to finish the ship.',
    'Return JSON: {"target":"C4","reasoning":"..."}',
    'The target MUST be copied exactly from the candidate list.',
    'Never pick a cell listed as FORBIDDEN or already attacked.',
  ].join('\n');
}

export function buildHistoryPrompt(history: import('../types/game.ts').BotShotRecord[]): string {
  if (history.length === 0) return '';
  return history
    .map((record) => {
      const label = `${String.fromCharCode(65 + record.coord.col)}${record.coord.row + 1}`;
      if (record.result.kind === 'miss') return `Shot ${label}: MISS`;
      if (record.result.kind === 'hit') return `Shot ${label}: HIT`;
      return `Shot ${label}: SUNK ${record.result.shipName} (size ${record.result.shipLength})`;
    })
    .join('\n');
}

export async function createMatchSession(
  remainingShipSizes: number[],
  history: import('../types/game.ts').BotShotRecord[],
): Promise<Awaited<ReturnType<NonNullable<typeof LanguageModel>['create']>>> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error(AI_UNAVAILABLE_REASON);
  }

  const initialPrompts = history.length
    ? [{ role: 'user', content: buildHistoryPrompt(history) }]
    : [];

  return LanguageModel.create({
    systemPrompt: buildSystemPrompt(remainingShipSizes),
    initialPrompts,
  });
}
