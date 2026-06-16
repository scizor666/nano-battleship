import { describe, expect, it } from 'vitest';
import { sanitizeQuip } from './commentary.ts';

describe('sanitizeQuip', () => {
  it('passes clean, kid-friendly quips through', () => {
    expect(sanitizeQuip('Splash! The fish are giggling. 🐟')).toBe(
      'Splash! The fish are giggling. 🐟',
    );
  });

  it('strips wrapping quotes and list markers', () => {
    expect(sanitizeQuip('"Boom, a soggy surprise!"')).toBe('Boom, a soggy surprise!');
    expect(sanitizeQuip('- Kerplunk!')).toBe('Kerplunk!');
  });

  it('keeps only the first line', () => {
    expect(sanitizeQuip('Splash!\nignore this extra reasoning')).toBe('Splash!');
  });

  it('rejects profanity and mean words', () => {
    expect(sanitizeQuip('You are so stupid')).toBeNull();
    expect(sanitizeQuip('That was a damn good shot')).toBeNull();
    expect(sanitizeQuip('Time to kill your fleet')).toBeNull();
    expect(sanitizeQuip('haha you loser')).toBeNull();
  });

  it('is not fooled by punctuation around banned words', () => {
    expect(sanitizeQuip('Wow, stupid!')).toBeNull();
    expect(sanitizeQuip('(idiot)')).toBeNull();
  });

  it('does not flag safe words that merely contain banned substrings', () => {
    // "class" contains "ass", "assist" contains "ass" — must not be filtered.
    expect(sanitizeQuip('Top of the class, captain!')).toBe('Top of the class, captain!');
    expect(sanitizeQuip('The crew will assist you!')).toBe('The crew will assist you!');
  });

  it('returns null for empty input', () => {
    expect(sanitizeQuip('')).toBeNull();
    expect(sanitizeQuip('   ')).toBeNull();
  });

  it('passes a normal one-sentence quip through without truncation', () => {
    // ~20 words: longer than the old 16-word cap, but a legitimate one-liner.
    const quip =
      'Kerplunk goes the cannonball as the silly crabs duck and the seagulls cheer for one more splashy turn!';
    expect(sanitizeQuip(quip)).toBe(quip);
  });

  it('truncates only runaway output as a safety backstop', () => {
    const long = `Splash ${'la '.repeat(120)}end`;
    const result = sanitizeQuip(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(244);
    expect(result!.endsWith('…')).toBe(true);
  });
});
