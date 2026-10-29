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

/** Fallback web que funciona em qualquer navegador sem depender de modelos locais de IA. */
async function translateWebFallback(text: string, source: TranslateLang, target: TranslateLang): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Não foi possível traduzir.');
  const data = (await res.json()) as unknown;
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const segments = data[0] as unknown[];
    const result = segments
      .map(item => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
      .join('');
    if (result) return result;
  }
  throw new Error('Não foi possível traduzir.');
}

/** Pronto para traduzir sem esperar download (na web o fallback é imediato). */
export async function isTranslatorReady(source: TranslateLang, target: TranslateLang): Promise<boolean> {
  if (source === target) return true;
  if (api) {
    try {
      const avail = await api.availability({ sourceLanguage: source, targetLanguage: target });
      if (avail === 'available') return true;
    } catch {
      // cai no fallback
    }
  }
  return true;
}

export async function translate(text: string, source: TranslateLang, target: TranslateLang): Promise<string> {
  if (!text.trim() || source === target) return text;

  // 1. Tenta o tradutor do Chrome se disponível e pronto
  if (api) {
    const key = `${source}>${target}`;
    try {
      const avail = await api.availability({ sourceLanguage: source, targetLanguage: target }).catch(() => 'unavailable');
      if (avail === 'available') {
        const t = await translatorFor(source, target);
        const result = await t.translate(text);
        if (result) return result;
      }
    } catch (err) {
      cache.delete(key);
      console.warn('[Translator.web] Falha no modelo local do Chrome, usando fallback web:', err);
    }
  }

  // 2. Fallback web resiliente (evita "Other generic failures occurred" e funciona em qualquer navegador)
  return translateWebFallback(text, source, target);
}

export const isSimulated = false;
