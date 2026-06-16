import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureModelReady,
  isModelReady,
  resetModelReadyForTests,
} from './availability.ts';

describe('ensureModelReady', () => {
  beforeEach(() => {
    resetModelReadyForTests();
  });

  it('destroys the warmup session and marks the model ready', async () => {
    const destroy = vi.fn();
    const create = vi.fn(async () => ({ prompt: vi.fn(), destroy }));
    vi.stubGlobal('LanguageModel', {
      availability: vi.fn(async () => 'available'),
      create,
    });

    await ensureModelReady();

    expect(create).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(isModelReady()).toBe(true);

    await ensureModelReady();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
