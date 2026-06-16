import type { OpponentType } from '../types/game.ts';

const STORAGE_KEY = 'nano-battleship-settings';

export interface Settings {
  opponent: OpponentType;
  muted: boolean;
  reducedMotion: boolean;
  commentary: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  opponent: 'huntTarget',
  muted: false,
  reducedMotion: false,
  commentary: false,
};

const VALID_OPPONENTS: ReadonlySet<OpponentType> = new Set([
  'huntTarget',
  'probability',
]);

function normalizeOpponent(value: unknown): OpponentType {
  return VALID_OPPONENTS.has(value as OpponentType)
    ? (value as OpponentType)
    : DEFAULT_SETTINGS.opponent;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      // Migrate any retired opponent (e.g. the old "aiNano" player) to a valid one.
      opponent: normalizeOpponent(parsed.opponent),
      muted: parsed.muted ?? DEFAULT_SETTINGS.muted,
      reducedMotion: parsed.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
      commentary: parsed.commentary ?? DEFAULT_SETTINGS.commentary,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
