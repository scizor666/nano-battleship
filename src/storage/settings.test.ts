import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from './settings.ts';

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
      commentary: false,
    });
  });

  it('persists and reloads settings', () => {
    saveSettings({
      opponent: 'probability',
      muted: true,
      reducedMotion: true,
      commentary: true,
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadSettings()).toEqual({
      opponent: 'probability',
      muted: true,
      reducedMotion: true,
      commentary: true,
    });
  });

  it('migrates a retired opponent to the default', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ opponent: 'aiNano', muted: false, reducedMotion: false, commentary: true }),
    );
    expect(loadSettings().opponent).toBe('huntTarget');
  });
});
