/**
 * Ditado por voz do teclado (Android): a pessoa fala e o texto vai para o campo da
 * conversa (android/.../VoiceTypingModule.kt). No iPhone não existe: a Apple não
 * deixa teclados de terceiros usarem o microfone (o iPhone já mostra o ditado dele
 * embaixo de qualquer teclado).
 */
import { NativeEventEmitter, NativeModules } from 'react-native';
import { t } from '../i18n';
import type { Lang } from '../i18n';

interface VoiceTypingNative {
  isAvailable(): Promise<boolean>;
  start(lang: string): Promise<boolean>;
  stop(): void;
}

export type DictationEvent =
  | { type: 'listening' }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'stopped' }
  | { type: 'error'; code: number };

const Native: VoiceTypingNative | undefined = NativeModules.KeyconVoiceTyping;
const emitter = Native ? new NativeEventEmitter(NativeModules.KeyconVoiceTyping) : null;

/** Idioma do ditado: o de digitação, com o país mais comum de cada um. */
const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-US' };

export const VoiceTyping = {
  /** Este aparelho tem o ditado do KEYCON (só no Android). */
  canDictate: !!Native,
  isAvailable: (): Promise<boolean> => (Native ? Native.isAvailable() : Promise.resolve(false)),
  start: (lang: Lang): Promise<boolean> => (Native ? Native.start(LOCALE[lang]) : Promise.resolve(false)),
  stop: () => Native?.stop(),
  onEvent(cb: (e: DictationEvent) => void): () => void {
    const sub = emitter?.addListener('onDictation', cb);
    return () => sub?.remove();
  },
};

/** Mensagem para cada erro do reconhecimento de voz do Android (SpeechRecognizer.ERROR_*). */
export function dictationError(code: number): string {
  switch (code) {
    case 9:
      return t('Permita o microfone para o KEYCON nas configurações do celular.');
    case 1:
    case 2:
      return t('Sem internet para o ditado. Baixe o idioma para usar sem internet nas configurações de voz do celular.');
    case 12:
    case 13:
      return t('O ditado ainda não tem esse idioma neste celular. Baixe nas configurações de voz do Android.');
    case 8:
      return t('O microfone está ocupado. Tente de novo em instantes.');
    default:
      return t('Não foi possível usar o ditado agora. Tente de novo.');
  }
}
