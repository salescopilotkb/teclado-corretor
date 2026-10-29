/**
 * Tradutor — versão WEB (site de testes). Usa o tradutor embutido do Chrome
 * (Translator API, Chrome 138+ no computador): roda no próprio aparelho, sem
 * servidor nem chave, como o Google ML Kit no celular. Mesma API do Translator.ts.
 *
 * Na 1ª vez de cada par de idiomas o Chrome baixa o modelo (alguns segundos).
 * Em navegador sem a API, a tradução avisa que não está disponível.
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

interface ChromeTranslator {
  translate(text: string): Promise<string>;
}
interface ChromeTranslatorFactory {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<ChromeTranslator>;
}

const api: ChromeTranslatorFactory | undefined =
  typeof globalThis !== 'undefined' ? (globalThis as { Translator?: ChromeTranslatorFactory }).Translator : undefined;

export const canTranslate = true;

/** Um tradutor por par de idiomas (criar é caro: o Chrome carrega o modelo). */
const cache = new Map<string, Promise<ChromeTranslator>>();
function translatorFor(source: TranslateLang, target: TranslateLang): Promise<ChromeTranslator> {
  const key = `${source}>${target}`;
  let t = cache.get(key);
  if (!t) {
    t = api!.create({ sourceLanguage: source, targetLanguage: target });
    t.catch(() => cache.delete(key));
    cache.set(key, t);
  }
  return t;
}

/** Pronto para traduzir sem esperar download (o painel mostra "baixando" quando não está). */
export async function isTranslatorReady(source: TranslateLang, target: TranslateLang): Promise<boolean> {
  if (!api) return false;
  try {
    return (await api.availability({ sourceLanguage: source, targetLanguage: target })) === 'available';
  } catch {
    return false;
  }
}

export async function translate(text: string, source: TranslateLang, target: TranslateLang): Promise<string> {
  if (!text.trim() || source === target) return text;
  if (!api) throw new Error('Tradução indisponível neste navegador. Use o Google Chrome no computador.');
  const t = await translatorFor(source, target);
  return t.translate(text);
}

export const isSimulated = false;
