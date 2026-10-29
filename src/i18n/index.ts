/**
 * Idiomas do KEYCON (app e teclado).
 *
 * O texto em português é a própria chave: t('Salvar') devolve "Salvar",
 * "Save" ou "Guardar" conforme o idioma. Variáveis vão entre chaves:
 * t('Olá, {nome}', { nome }). Sem tradução, mostra o português.
 *
 * Dois idiomas por usuário:
 *  - o do usuário (`language`): telas do app e do teclado e o corretor
 *    (segurar o espaço troca o idioma do corretor);
 *  - o de venda (do mercado, ver markets.ts): mensagens que vão para o
 *    cliente (ficha do produto, retorno do CRM, IA).
 */
import { EN } from './en';
import { ES } from './es';

export type Lang = 'pt' | 'en' | 'es';

export const LANGUAGES: Array<{ id: Lang; label: string }> = [
  // Inglês primeiro: o lançamento é nos EUA; português e espanhol vêm em seguida
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português' },
  { id: 'es', label: 'Español' },
];

export function isLang(value: unknown): value is Lang {
  return value === 'pt' || value === 'en' || value === 'es';
}

const DICTIONARIES: Record<Exclude<Lang, 'pt'>, Record<string, string>> = { en: EN, es: ES };

// Idioma inicial do app: inglês (quem já tem perfil salvo volta ao idioma que escolheu)
let current: Lang = 'en';
const listeners = new Set<(lang: Lang) => void>();

/**
 * Idioma das telas — e do corretor do teclado: trocar o idioma do app troca
 * também as sugestões e correções. Quem desenha a tela relê com useLanguage().
 */
export function setLanguage(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  // O teclado volta a digitar no idioma escolhido
  typingOverride = null;
  listeners.forEach(cb => cb(lang));
  typingListeners.forEach(cb => cb(lang));
}

export function getLanguage(): Lang {
  return current;
}

export function onLanguageChange(cb: (lang: Lang) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

let selling: Lang = 'en';
const sellingListeners = new Set<(lang: Lang) => void>();

/** Idioma de venda: mensagens que vão para o cliente (ficha, retorno do CRM, IA). */
export function setSellingLanguage(lang: Lang): void {
  if (lang === selling) return;
  selling = lang;
  sellingListeners.forEach(cb => cb(lang));
}

export function getSellingLanguage(): Lang {
  return selling;
}

export function onSellingLanguageChange(cb: (lang: Lang) => void): () => void {
  sellingListeners.add(cb);
  return () => {
    sellingListeners.delete(cb);
  };
}

/**
 * Idioma em que o teclado está digitando (corretor, sugestões, tecla ñ).
 * É o idioma do app; segurar o espaço troca (ex.: escrever ao cliente no
 * idioma de venda, quando é outro).
 */
let typingOverride: Lang | null = null;
const typingListeners = new Set<(lang: Lang) => void>();

export function getTypingLanguage(): Lang {
  return typingOverride ?? current;
}

export function setTypingLanguage(lang: Lang): void {
  const next = lang === current ? null : lang;
  if (next === typingOverride) return;
  typingOverride = next;
  typingListeners.forEach(cb => cb(lang));
}

export function onTypingLanguageChange(cb: (lang: Lang) => void): () => void {
  typingListeners.add(cb);
  return () => {
    typingListeners.delete(cb);
  };
}

/** Próximo idioma ao segurar o espaço: o do app, o de venda e depois o outro. */
export function nextTypingLanguage(): Lang {
  const order = [...new Set<Lang>([current, selling, 'pt', 'en', 'es'])];
  return order[(order.indexOf(getTypingLanguage()) + 1) % order.length];
}

/** Texto no idioma de venda (ficha do produto, retorno do CRM...). */
export function tSell(text: string, vars?: Vars): string {
  return tIn(selling, text, vars);
}

/** Texto no idioma das telas. */
export function t(text: string, vars?: Vars): string {
  return tIn(current, text, vars);
}

/** Texto num idioma específico (ex.: o de venda, para mensagens ao cliente). */
export function tIn(lang: Lang, text: string, vars?: Vars): string {
  const translated = lang === 'pt' ? text : DICTIONARIES[lang][text] ?? text;
  return fill(translated, vars);
}

/** Código do idioma para o sistema e a IA ("pt-BR", "en-US", "es"). */
export function localeOf(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es';
}
