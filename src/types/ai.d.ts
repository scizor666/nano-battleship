interface LanguageModelCreateOptions {
  systemPrompt?: string;
  initialPrompts?: Array<{ role: string; content: string }>;
  monitor?: (monitor: LanguageModelMonitor) => void;
}

interface LanguageModelMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: LanguageModelDownloadProgressEvent) => void,
  ): void;
}

interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number;
}

interface LanguageModelPromptOptions {
  responseConstraint?: Record<string, unknown>;
  omitResponseConstraintInput?: boolean;
}

interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(options?: LanguageModelCreateOptions): Promise<
    'available' | 'downloadable' | 'downloading' | 'unavailable'
  >;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare global {
  interface Window {
    LanguageModel?: LanguageModelStatic;
  }

  const LanguageModel: LanguageModelStatic | undefined;
}

export {};
