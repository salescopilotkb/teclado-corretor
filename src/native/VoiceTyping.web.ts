/** Versão web de testes: sem ditado por voz (o botão não aparece). */
import type { Lang } from '../i18n';

export type DictationEvent =
  | { type: 'listening' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'stopped' }
  | { type: 'error'; code: number };

export const VoiceTyping = {
  canDictate: false,
  isAvailable: (): Promise<boolean> => Promise.resolve(false),
  start: (_lang: Lang): Promise<boolean> => Promise.resolve(false),
  stop: () => undefined,
  onEvent: (_cb: (e: DictationEvent) => void): (() => void) => () => undefined,
};

export const dictationError = (_code: number): string => '';
