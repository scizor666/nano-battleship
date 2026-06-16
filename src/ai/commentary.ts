import { debugLogger } from './debugLogger.ts';
import type { ShotResult } from '../types/game.ts';

export interface CommentaryEvent {
  /** Who just fired the shot. */
  actor: 'player' | 'opponent';
  /** Outcome of the shot. */
  result: ShotResult;
  /** Human-readable cell label, e.g. "C4". */
  coordLabel: string;
}

// The persona prompt already asks for one short sentence; these caps are a
// safety backstop against runaway output, not a routine trimmer. Keep them
// generous so a normal one-liner is shown in full (and not visibly cut with "…").
const MAX_WORDS = 40;
const MAX_CHARS = 240;

/**
 * Defense-in-depth profanity / unsafe-content filter. The system prompt asks the
 * model to stay kid-friendly, but a small on-device model can slip, so every quip
 * is screened against this list before it ever reaches the screen. Matching is
 * done on word boundaries against a lowercased copy of the text.
 */
const BANNED_WORDS = [
  'damn', 'hell', 'crap', 'piss', 'screw', 'suck', 'sucks', 'butt', 'fart',
  'stupid', 'idiot', 'dumb', 'moron', 'loser', 'hate', 'kill', 'die', 'dead',
  'death', 'blood', 'bloody', 'gun', 'guns', 'shoot', 'shot', 'bomb', 'weapon',
  'fool', 'shut up', 'ugly', 'fat',
  // Hard profanity (kept obfuscation-free so the matcher is honest about intent).
  'ass', 'arse', 'bastard', 'bitch', 'shit', 'fuck', 'dick', 'cock', 'prick',
  'slut', 'whore', 'sex', 'nazi', 'racist',
];

const SAFE_FALLBACKS: Record<CommentaryEvent['result']['kind'], string[]> = {
  miss: [
    'Splash! Just some grumpy fish down there. 🐟',
    'Whoosh — nothing but bubbles and seaweed!',
    'Missed! The crabs are giggling at us.',
    'Kerplunk! That cannonball is going for a swim.',
  ],
  hit: [
    'Boom — a soggy surprise! Someone needs a bucket. 🪣',
    'Direct splash! That ship just got a chilly bath.',
    'Ker-splash! The seagulls are very impressed.',
    'Ouch, a wet wallop! Bail out the rubber ducks!',
  ],
  sunk: [
    'Blub blub — down it goes to say hi to the whales! 🐋',
    'That ship is now a cozy home for friendly fish!',
    'Glug glug! Time for a submarine nap. 😴',
    'Whoosh — sailing straight to the seabed sleepover!',
  ],
};

function pickFallback(kind: CommentaryEvent['result']['kind']): string {
  const options = SAFE_FALLBACKS[kind];
  return options[Math.floor(Math.random() * options.length)]!;
}

/**
 * Cleans and screens a raw model quip. Returns a kid-safe one-liner, or `null`
 * if the text is empty or trips the profanity filter (caller should fall back).
 */
export function sanitizeQuip(raw: string): string | null {
  if (!raw) return null;

  // Keep only the first line/sentence and strip wrapping quotes or list markers.
  let text = raw.split('\n')[0]!.trim();
  text = text.replace(/^["'`*\-\d.\)\s]+/, '').replace(/["'`*]+$/, '').trim();
  if (!text) return null;

  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS).trimEnd()}…`;
  }

  const words = text.split(/\s+/);
  if (words.length > MAX_WORDS) {
    text = `${words.slice(0, MAX_WORDS).join(' ')}…`;
  }

  const lowered = ` ${text.toLowerCase().replace(/[^a-z\s]/g, ' ')} `;
  for (const banned of BANNED_WORDS) {
    if (lowered.includes(` ${banned} `)) {
      debugLogger.warn('commentary', `Filtered unsafe quip (matched "${banned}")`, raw);
      return null;
    }
  }

  return text;
}

const SYSTEM_PROMPT = [
  'You are Captain Quack, a silly and friendly cartoon duck captain who narrates a',
  'game of Battleship for young children.',
  'Strict rules for every reply:',
  '- Reply with ONE short, cheerful sentence (16 words or fewer).',
  '- Be playful, gentle, and funny — like a cartoon for 7-year-olds.',
  '- Absolutely NO profanity, insults, name-calling, scary words, violence, blood,',
  '  guns, or anything mean. Keep it cartoony: splashes, bubbles, fish, rubber ducks.',
  '- Never put down the player. Tease lightly and kindly, like a goofy friend.',
  '- You may add ONE friendly emoji.',
  'Reply with ONLY the sentence — no quotes, no labels, no explanations.',
].join('\n');

function buildEventPrompt(event: CommentaryEvent): string {
  const who = event.actor === 'player' ? 'The player' : 'You (the duck captain)';
  const where = `at ${event.coordLabel}`;
  if (event.result.kind === 'miss') {
    return `${who} fired ${where} and MISSED — just a big splash. Give one silly cheer.`;
  }
  if (event.result.kind === 'hit') {
    return `${who} fired ${where} and HIT a ship! Give one silly, friendly reaction.`;
  }
  return `${who} fired ${where} and SANK the ${event.result.shipName}! Give one goofy, kind reaction.`;
}

export class NanoCommentator {
  private session: Awaited<
    ReturnType<NonNullable<typeof LanguageModel>['create']>
  > | null = null;

  private busy = false;

  /** True while a quip is being generated, so callers can avoid piling up requests. */
  isBusy(): boolean {
    return this.busy;
  }

  async start(): Promise<void> {
    if (typeof LanguageModel === 'undefined') return;
    this.reset();
    try {
      this.session = await LanguageModel.create({ systemPrompt: SYSTEM_PROMPT });
      debugLogger.log('commentary', 'Commentator session created');
    } catch (error) {
      debugLogger.warn('commentary', 'Failed to create commentator session', error);
      this.session = null;
    }
  }

  reset(): void {
    this.session?.destroy();
    this.session = null;
    this.busy = false;
  }

  /**
   * Generates a kid-safe quip for an event. Always resolves to a safe string:
   * a model line when possible, otherwise a canned fallback. Never throws.
   */
  async comment(event: CommentaryEvent): Promise<string> {
    if (!this.session || this.busy) {
      return pickFallback(event.result.kind);
    }

    this.busy = true;
    try {
      const raw = await this.session.prompt(buildEventPrompt(event));
      debugLogger.log('commentary', 'Raw quip', raw);
      return sanitizeQuip(raw) ?? pickFallback(event.result.kind);
    } catch (error) {
      debugLogger.warn('commentary', 'Quip generation failed', error);
      return pickFallback(event.result.kind);
    } finally {
      this.busy = false;
    }
  }
}
