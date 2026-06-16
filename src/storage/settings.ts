import type { OpponentType } from '../types/game.ts';

const STORAGE_KEY = 'nano-battleship-settings';

export interface Settings {
  opponent: OpponentType;
  muted: boolean;
  reducedMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  opponent: 'huntTarget',
  muted: false,
  reducedMotion: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      opponent: parsed.opponent ?? DEFAULT_SETTINGS.opponent,
      muted: parsed.muted ?? DEFAULT_SETTINGS.muted,
      reducedMotion: parsed.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resolveOpponent(
  preferred: OpponentType,
  aiAvailable: boolean,
): OpponentType {
  if (preferred === 'aiNano' && !aiAvailable) {
    return 'huntTarget';
  }
  return preferred;
}
