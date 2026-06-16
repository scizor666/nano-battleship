import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSettings,
  resolveOpponent,
  saveSettings,
} from './settings.ts';

const STORAGE_KEY = 'nano-battleship-settings';

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadSettings()).toEqual({
      opponent: 'huntTarget',
      muted: false,
      reducedMotion: false,
    });
  });

  it('persists and reloads settings', () => {
    saveSettings({
      opponent: 'probability',
      muted: true,
      reducedMotion: true,
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadSettings()).toEqual({
      opponent: 'probability',
      muted: true,
      reducedMotion: true,
    });
  });

  it('falls back from aiNano when unavailable', () => {
    expect(resolveOpponent('aiNano', false)).toBe('huntTarget');
    expect(resolveOpponent('aiNano', true)).toBe('aiNano');
    expect(resolveOpponent('probability', false)).toBe('probability');
  });
});
