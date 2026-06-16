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

  // Warmup session only triggers the download; commentary uses its own session.
  warmup.destroy();
  modelReady = true;
  debugLogger.log('session', 'On-device model ready');
}
