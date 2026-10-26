/**
 * Tradutor do teclado (botão "Traduzir"): Google ML Kit Translation no
 * próprio aparelho, pelo módulo nativo KeyconTranslator (Android). Sem chave
 * de API e sem enviar o texto para fora do celular; cada idioma é baixado uma
 * vez (~30 MB) e depois funciona sem internet.
 */
import { NativeModules } from 'react-native';

interface TranslatorNative {
  isReady(source: string, target: string): Promise<boolean>;
  translate(text: string, source: string, target: string): Promise<string>;
}

const Native: TranslatorNative | undefined = NativeModules.KeyconTranslator;

/** Idiomas da tradução (códigos do ML Kit). */
export const TRANSLATE_LANGUAGES = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'it', label: 'Italiano' },
  { id: 'de', label: 'Deutsch' },
] as const;

export type TranslateLang = (typeof TRANSLATE_LANGUAGES)[number]['id'];

/** O tradutor existe neste aparelho. */
export const canTranslate = !!Native;

/** Os dois idiomas já estão baixados (a 1ª tradução não vai demorar)? */
export function isTranslatorReady(source: TranslateLang, target: TranslateLang): Promise<boolean> {
  return Native ? Native.isReady(source, target).catch(() => false) : Promise.resolve(false);
}

export function translate(text: string, source: TranslateLang, target: TranslateLang): Promise<string> {
  if (!Native) return Promise.reject(new Error('Tradução disponível no aplicativo Android.'));
  return Native.translate(text, source, target);
}

/** Na versão web de testes a tradução é simulada (o ML Kit só existe no celular). */
export const isSimulated = false;
