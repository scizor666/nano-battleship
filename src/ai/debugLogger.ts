import type { DebugLogEntry } from '../types/game.ts';

const MAX_ENTRIES = 200;

class DebugLogger {
  private entries: DebugLogEntry[] = [];

  log(category: string, message: string, detail?: unknown): void {
    this.push('info', category, message, detail);
  }

  warn(category: string, message: string, detail?: unknown): void {
    this.push('warn', category, message, detail);
  }

  error(category: string, message: string, detail?: unknown): void {
    this.push('error', category, message, detail);
  }

  private push(
    level: DebugLogEntry['level'],
    category: string,
    message: string,
    detail?: unknown,
  ): void {
    const entry: DebugLogEntry = {
      id: crypto.randomUUID(),
      level,
      category,
      message,
      detail,
      timestamp: Date.now(),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }

    const prefix = `[NanoBattleship:${category}]`;
    if (level === 'info') console.info(prefix, message, detail ?? '');
    else if (level === 'warn') console.warn(prefix, message, detail ?? '');
    else console.error(prefix, message, detail ?? '');
  }

  getEntries(): DebugLogEntry[] {
    return [...this.entries];
  }
}

export const debugLogger = new DebugLogger();
