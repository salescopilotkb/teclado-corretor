/**
 * Tradutor — versão WEB (site de testes). O ML Kit só existe no celular:
 * aqui a "tradução" só marca o idioma ("[EN] texto"), para testar o fluxo
 * do botão Traduzir. Mesma API do Translator.ts.
 */
export const TRANSLATE_LANGUAGES = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'it', label: 'Italiano' },
  { id: 'de', label: 'Deutsch' },
] as const;

export type TranslateLang = (typeof TRANSLATE_LANGUAGES)[number]['id'];

export const canTranslate = true;

export const isTranslatorReady = async (_source: TranslateLang, _target: TranslateLang) => true;

export async function translate(text: string, source: TranslateLang, target: TranslateLang): Promise<string> {
  if (!text.trim() || source === target) return text;
  return `[${target.toUpperCase()}] ${text}`;
}

export const isSimulated = true;
