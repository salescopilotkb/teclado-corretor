/**
 * Palavras da própria pessoa: o teclado aprende com o uso.
 *
 *  - Conta as palavras que a pessoa termina de escrever (espaço, pontuação ou
 *    escolha na barra). Uma palavra fora do dicionário (gíria, apelido como
 *    "Lindeusa", nome de produto) usada 2 vezes passa a ser correta: some das
 *    aspas, não é mais corrigida e aparece como sugestão ao começar a digitá-la.
 *  - Desfazer uma correção (⌫) ou tocar na palavra "entre aspas" é um pedido
 *    claro: aprende na hora.
 *  - Também conta os pares de palavras seguidas ("bom" → "dia"), para prever a
 *    próxima palavra do jeito que a pessoa escreve.
 *
 * Fica só no aparelho, por idioma de digitação. Quem salva é o teclado
 * (setUserWordsStore); sem isso (testes), fica só na memória.
 */
import type { Lang } from '../../i18n';

/** Usos para uma palavra fora do dicionário virar "correta". */
export const LEARN_THRESHOLD = 2;
/** Limites para não crescer sem fim: ficam as mais usadas e recentes. */
const MAX_WORDS = 3000;
const MAX_PAIRS = 6000;
const SAVE_DELAY_MS = 2000;

/** form = como a pessoa escreve (mantém "Lindeusa" com maiúscula); c = usos; t = último dia de uso. */
interface WordStat {
  f: string;
  c: number;
  t: number;
}

interface LangData {
  words: Record<string, WordStat>;
  /** "anterior palavra" → usos */
  pairs: Record<string, number>;
}

export interface UserWordsStore {
  load(lang: Lang): string | undefined;
  save(lang: Lang, json: string): void;
}

let store: UserWordsStore | null = null;
const data: Partial<Record<Lang, LangData>> = {};
const dirty = new Set<Lang>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** O teclado liga o armazenamento do aparelho (MMKV). */
export function setUserWordsStore(next: UserWordsStore) {
  store = next;
  for (const lang of Object.keys(data) as Lang[]) {
    delete data[lang];
    delete learnedCache[lang];
  }
}

const today = () => Math.floor(Date.now() / 86_400_000);

function langData(lang: Lang): LangData {
  let d = data[lang];
  if (d) return d;
  d = { words: {}, pairs: {} };
  try {
    const raw = store?.load(lang);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LangData>;
      d = { words: parsed.words ?? {}, pairs: parsed.pairs ?? {} };
    }
  } catch {
    // Dado corrompido: recomeça do zero
  }
  data[lang] = d;
  return d;
}

function scheduleSave(lang: Lang) {
  dirty.add(lang);
  if (!store || saveTimer) return;
  saveTimer = setTimeout(flushUserWords, SAVE_DELAY_MS);
}

/** Grava o que mudou (também chamado ao fechar o teclado). */
export function flushUserWords() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!store) return;
  for (const lang of dirty) {
    const d = data[lang];
    if (d) store.save(lang, JSON.stringify(d));
  }
  dirty.clear();
}

/** Mantém só as mais usadas e recentes quando passa do limite. */
function prune(d: LangData) {
  const words = Object.entries(d.words);
  if (words.length > MAX_WORDS) {
    const now = today();
    words.sort((a, b) => b[1].c / (1 + (now - b[1].t) / 30) - a[1].c / (1 + (now - a[1].t) / 30));
    d.words = Object.fromEntries(words.slice(0, Math.floor(MAX_WORDS * 0.8)));
  }
  const pairs = Object.entries(d.pairs);
  if (pairs.length > MAX_PAIRS) {
    pairs.sort((a, b) => b[1] - a[1]);
    d.pairs = Object.fromEntries(pairs.slice(0, Math.floor(MAX_PAIRS * 0.8)));
  }
}

const WORD = /^[a-zà-öø-ÿ]+(?:[-'’][a-zà-öø-ÿ]+)*$/i;

/**
 * A pessoa terminou de escrever `word` (depois de `prev`, quando houver).
 * `weight` 2+ = pedido explícito (desfez a correção, escolheu a palavra entre aspas).
 */
export function learnWord(lang: Lang, word: string, prev?: string, weight = 1) {
  if (!word || word.length < 2 || word.length > 30 || !WORD.test(word)) return;
  const d = langData(lang);
  const key = word.toLowerCase();
  const old = d.words[key];
  // Começo de frase (prev "^"): a maiúscula é automática, não diz se é nome.
  // No meio da frase, guarda como a pessoa escreve ("Lindeusa", "iFood")
  const form = prev === '^' ? old?.f ?? key : word;
  d.words[key] = { f: form, c: (old?.c ?? 0) + weight, t: today() };
  if (prev && prev !== '^' && WORD.test(prev)) {
    const pair = `${prev.toLowerCase()} ${key}`;
    d.pairs[pair] = (d.pairs[pair] ?? 0) + weight;
  }
  prune(d);
  delete learnedCache[lang];
  scheduleSave(lang);
}

/** Quantas vezes a pessoa usou a palavra (0 = nunca). */
export function userCount(lang: Lang, word: string): number {
  return langData(lang).words[word.toLowerCase()]?.c ?? 0;
}

/** Já usou o bastante para ser uma palavra "dela" (correta mesmo fora do dicionário). */
export function isLearned(lang: Lang, word: string): boolean {
  return userCount(lang, word) >= LEARN_THRESHOLD;
}

/** Como a pessoa escreve a palavra ("Lindeusa"), ou undefined. */
export function learnedForm(lang: Lang, word: string): string | undefined {
  return langData(lang).words[word.toLowerCase()]?.f;
}

type Learned = Array<{ key: string; form: string; count: number }>;
/** Lista pronta por idioma (consultada a cada tecla): refeita só quando aprende algo. */
const learnedCache: Partial<Record<Lang, Learned>> = {};

/** Palavras aprendidas (usadas o bastante), com os usos: para completar e corrigir. */
export function learnedWords(lang: Lang): Learned {
  const cached = learnedCache[lang];
  if (cached) return cached;
  const out: Learned = [];
  for (const [key, s] of Object.entries(langData(lang).words)) {
    if (s.c >= LEARN_THRESHOLD) out.push({ key, form: s.f, count: s.c });
  }
  learnedCache[lang] = out;
  return out;
}

/** Quantas vezes a pessoa escreveu `word` logo depois de `prev`. */
export function pairCount(lang: Lang, prev: string | undefined, word: string): number {
  if (!prev) return 0;
  return langData(lang).pairs[`${prev.toLowerCase()} ${word.toLowerCase()}`] ?? 0;
}

/** O que a pessoa costuma escrever depois de `prev` (mais usado primeiro). */
export function nextFromPairs(lang: Lang, prev: string, minCount = LEARN_THRESHOLD): string[] {
  const d = langData(lang);
  const head = `${prev.toLowerCase()} `;
  return Object.entries(d.pairs)
    .filter(([pair, c]) => c >= minCount && pair.startsWith(head))
    .sort((a, b) => b[1] - a[1])
    .map(([pair]) => {
      const key = pair.slice(head.length);
      return d.words[key]?.f ?? key;
    });
}
