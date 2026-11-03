/**
 * Tema do Locker web: o mesmo do app KEYCON e do teclado. Escuro por padrão; quando a
 * pessoa troca o tema no app (claro, escuro ou o do sistema), o app grava no perfil
 * (profiles.theme) e o Locker segue ao entrar e sempre que a aba volta a ficar visível.
 * A última escolha fica guardada no navegador para abrir já com o tema certo (sem piscar).
 */
import { supabase } from './data';

export type ThemePreference = 'dark' | 'light' | 'system';

const KEY = 'keycon.theme';
const isTheme = (v: unknown): v is ThemePreference => v === 'dark' || v === 'light' || v === 'system';

let current: ThemePreference = 'dark';

function resolve(pref: ThemePreference): 'dark' | 'light' {
  if (pref !== 'system') return pref;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Aplica o tema na página (e guarda para a próxima visita). */
export function applyTheme(pref: ThemePreference) {
  current = pref;
  const scheme = resolve(pref);
  document.documentElement.dataset.theme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#14161D' : '#F4F6FA');
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // navegador sem armazenamento: vale só nesta visita
  }
}

/** Antes de desenhar a página: a última escolha, ou escuro. */
export function applySavedTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  applyTheme(isTheme(saved) ? saved : 'dark');
  // "Do sistema": acompanha quando o computador muda entre claro e escuro
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (current === 'system') applyTheme('system');
  });
}

/** O tema escolhido no app (perfil da conta). Banco sem a coluna: fica o que está. */
export async function applyProfileTheme(userId: string) {
  const { data, error } = await supabase.from('profiles').select('theme').eq('id', userId).maybeSingle();
  if (error) return;
  const theme = (data as { theme?: string } | null)?.theme;
  if (isTheme(theme) && theme !== current) applyTheme(theme);
}
