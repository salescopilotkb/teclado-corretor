/**
 * Idioma do Locker web: o do perfil da pessoa (o mesmo do app), e dá para trocar
 * na página. A troca vale neste navegador e não muda o app nem o teclado.
 *
 * Ordem: o escolhido na página → o do perfil (depois de entrar) → o do navegador.
 */
import { isLang, setLanguage } from '../../src/i18n';
import type { Lang } from '../../src/i18n';
import { supabase } from './data';
import { PREVIEW } from './demo';

const KEY = 'locker.lang';

/** O que a pessoa escolheu na página (null = segue o perfil). */
export function chosenLanguage(): Lang | null {
  const saved = localStorage.getItem(KEY);
  return isLang(saved) ? saved : null;
}

export function browserLanguage(): Lang {
  const code = (navigator.language || 'en').slice(0, 2);
  return code === 'pt' ? 'pt' : code === 'es' ? 'es' : 'en';
}

export function applyLanguage(lang: Lang) {
  setLanguage(lang);
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

/** Troca feita na página: fica guardada neste navegador. */
export function chooseLanguage(lang: Lang) {
  localStorage.setItem(KEY, lang);
  applyLanguage(lang);
}

/** Depois de entrar: usa o idioma do perfil, se a pessoa não escolheu outro na página. */
export async function applyProfileLanguage(userId: string) {
  if (chosenLanguage() || PREVIEW) return;
  const { data } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  const lang = (data as { language?: string } | null)?.language;
  if (isLang(lang)) applyLanguage(lang);
}
