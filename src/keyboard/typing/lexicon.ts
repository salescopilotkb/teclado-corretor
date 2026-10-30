/**
 * Motor de palavras do teclado (português, inglês e espanhol).
 *
 *  - suggest(): completa a palavra, corrige erro de digitação e devolve o
 *    acento ("voce" → "você") para a barra de sugestões, levando em conta o
 *    histórico e o contexto da frase (janela expandida, n-gramas e concordância),
 *    e diz se dá para corrigir sozinho;
 *  - predictNext(): as próximas palavras prováveis, logo depois do espaço,
 *    combinando bigramas e predições contextuais da oração;
 *  - nextLetterLogProb(): chance de cada letra ser a próxima da palavra — é o
 *    que deixa a "área invisível" da tecla provável maior (ver keyResolver).
 *
 * Suporta:
 *  - Palavras da própria pessoa (userWords): gírias e apelidos usados com
 *    frequência viram corretos e passam a ser sugeridos ("Lindeusa");
 *  - Acento pelo contexto em palavras que existem com e sem acento ("o pao" → "pão",
 *    "onde esta" → "está");
 *  - Palavras coladas: as frases conhecidas são corrigidas sozinhas ("bomdia" →
 *    "bom dia"); as outras separações ("parada" → "para da") só aparecem como
 *    opção, sem trocar a palavra;
 *  - Tolerância estendida a palavras muito erradas (busca fonética e teclado);
 *  - Nomes próprios de pessoas brasileiras populares e marcas famosas;
 *  - Capitalização estrita da palavra "Deus" sempre com 'D' maiúsculo.
 *
 * Tudo roda no próprio aparelho, sem internet. O índice é montado fora do
 * caminho do primeiro toque. Segue o idioma de digitação.
 */
import { getTypingLanguage, onTypingLanguageChange } from '../../i18n';
import type { Lang } from '../../i18n';
import { BIGRAMS_EN } from './bigramsEn';
import { BIGRAMS_ES } from './bigramsEs';
import { BIGRAMS_PT } from './bigramsPt';
import { WORDS_EN } from './wordsEn';
import { WORDS_ES } from './wordsEs';
import { WORDS_PT } from './wordsPt';
import {
  ALWAYS_CAPITALIZED,
  BRAND_NAMES,
  PEOPLE_NAMES,
  COMMON_SPLIT_PHRASES,
  getProperDisplayForm,
  getCollocationBoost,
  getContextualNextPredictions,
} from './properNouns';
import { isLearned, learnedForm, learnedWords, nextFromPairs, pairCount, userCount } from './userWords';

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/** Minúsculas e sem acento: "Você" → "voce" (chave de busca). */
export function toKey(word: string): string {
  const lower = word.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    out += ACCENT_MAP[c] ?? c;
  }
  return out;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** Teclas vizinhas no QWERTY: trocar por uma delas é o erro mais comum. */
const NEIGHBORS: Record<string, string> = {
  q: 'wa', w: 'qeas', e: 'wrsd', r: 'etdf', t: 'ryfg', y: 'tugh', u: 'yihj', i: 'uojk', o: 'ipkl', p: 'ol',
  a: 'qwsz', s: 'awedxz', d: 'serfcx', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb', j: 'huikmn', k: 'jiolm', l: 'kop',
  z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb', b: 'vghn', n: 'bhjm', m: 'njk',
};

/**
 * Trocas fonéticas comuns no português (s/c, z/s, j/g, m/n, etc.).
 * Reduzem o custo de substituição para 0.4 para aproximar erros gramaticais e de pronúncia.
 */
const PHONETIC_EQUIVALENTS: Record<string, string> = {
  c: 'sz',
  s: 'cz',
  z: 'sc',
  j: 'g',
  g: 'j',
  m: 'n',
  n: 'm',
  x: 's',
};

/** Alternativas para a letra inicial na busca de palavras muito erradas. */
const INITIAL_ALTERNATIVES: Record<string, string> = {
  c: 'sz',
  s: 'cz',
  z: 'sc',
  g: 'j',
  j: 'g',
  o: 'h',
  h: 'oaei',
  x: 's',
};

/** Posição de cada tecla no teclado (coluna, fileira), com o recuo real das fileiras de baixo. */
const KEY_POS: Record<string, [number, number]> = (() => {
  const out: Record<string, [number, number]> = {};
  ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach((row, y) => {
    const indent = [0, 0.5, 1.5][y];
    [...row].forEach((c, x) => (out[c] = [x + indent, y]));
  });
  out['ñ'] = [9.5, 1];
  return out;
})();

/**
 * Custo de trocar a letra `a` pela `b` (digitou `a` querendo `b`): o dedo
 * escorregar para o lado na mesma fileira (r↔t) é o erro mais comum;
 * trocas fonéticas (c↔s, z↔s, j↔g) têm custo bem reduzido (0.4).
 */
function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  if (currentLexiconLang === 'pt' && PHONETIC_EQUIVALENTS[a]?.includes(b)) {
    return 0.4;
  }
  const pa = KEY_POS[a];
  const pb = KEY_POS[b];
  if (!pa || !pb) return 1.6;
  const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  if (pa[1] === pb[1] && d <= 1.01) return 0.5;
  return d <= 1.2 ? 0.7 : d <= 2.3 ? 1.2 : 1.6;
}

/** Até esta posição na lista, a palavra entra na busca ampla (as mais usadas). */
const FUZZY_RANK = 22000;
/** Busca ampla só para palavras com pelo menos tantas letras. */
const FUZZY_MIN_LENGTH = 3;
/**
 * Placar da busca ampla: o formato pesa mais que o quanto a palavra é comum.
 */
const FUZZY_FREQ_WEIGHT = 0.2;
const FUZZY_DISTANCE_WEIGHT = 2.4;
/** Folga extra sobre a 2ª opção para a busca ampla corrigir sozinha. */
const FUZZY_MARGIN = 1.4;

/** Linhas da conta de distância, reaproveitadas (a busca roda a cada letra). */
let rowA = new Float32Array(32);
let rowB = new Float32Array(32);
let rowC = new Float32Array(32);

/**
 * Distância entre o que foi digitado e a palavra, pelo teclado (Damerau-
 * Levenshtein com pesos): tecla vizinha 0,5–0,7 (ver substitutionCost); letra
 * a mais 1,0 (0,8 se for vizinha da anterior); letra faltando 0,9;
 * duas letras invertidas 0,7.
 */
function keyboardDistance(typed: string, word: string, limit: number): number {
  const n = typed.length;
  const m = word.length;
  if (m + 1 > rowA.length) {
    rowA = new Float32Array(m + 8);
    rowB = new Float32Array(m + 8);
    rowC = new Float32Array(m + 8);
  }
  let prev2 = rowA;
  let prev = rowB;
  let cur = rowC;
  for (let j = 0; j <= m; j++) prev[j] = j * 0.9;
  for (let i = 1; i <= n; i++) {
    const t = typed[i - 1];
    const extra = i > 1 && substitutionCost(t, typed[i - 2]) <= 0.7 ? 0.8 : 1.0;
    cur[0] = i * 0.9;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      const w = word[j - 1];
      const missing = w === 'u' && j > 1 && word[j - 2] === 'q' ? 0.4 : 0.9;
      let v = prev[j] + extra;
      const ins = cur[j - 1] + missing;
      if (ins < v) v = ins;
      const sub = prev[j - 1] + substitutionCost(t, w);
      if (sub < v) v = sub;
      if (i > 1 && j > 1 && t === word[j - 2] && typed[i - 2] === w && prev2[j - 2] + 0.7 < v) v = prev2[j - 2] + 0.7;
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > limit) return Infinity;
    const spare = prev2;
    prev2 = prev;
    prev = cur;
    cur = spare;
  }
  return prev[m];
}

/** Erro aceito na busca ampla: ampliado para capturar palavras muito erradas. */
const fuzzyLimit = (length: number) => Math.min(4.2, 1.2 + length * 0.35);

/** Palavras da busca ampla por letra inicial (montado uma vez por idioma). */
const fuzzyIndexCache: Partial<Record<Lang, Map<string, Entry[]>>> = {};

function fuzzyIndex(lex: Lexicon): Map<string, Entry[]> {
  const cached = fuzzyIndexCache[currentLexiconLang];
  if (cached) return cached;
  const index = new Map<string, Entry[]>();
  for (const e of lex.sorted) {
    if (e.rank > FUZZY_RANK || !e.key) continue;
    const list = index.get(e.key[0]);
    if (list) list.push(e);
    else index.set(e.key[0], [e]);
  }
  fuzzyIndexCache[currentLexiconLang] = index;
  return index;
}

/** Última busca ampla (a mesma palavra é consultada várias vezes: barra, espaço...). */
let fuzzyCache: { lang: Lang; key: string; hits: Array<{ e: Entry; distance: number }> } | null = null;

/** Palavras parecidas pelo teclado e fonética: mesmo começo, tecla vizinha, fonética ou inversão inicial. */
function fuzzyMatches(lex: Lexicon, key: string): Array<{ e: Entry; distance: number }> {
  if (fuzzyCache && fuzzyCache.lang === currentLexiconLang && fuzzyCache.key === key) return fuzzyCache.hits;
  const limit = fuzzyLimit(key.length);
  const index = fuzzyIndex(lex);
  const hits: Array<{ e: Entry; distance: number }> = [];
  const triedFirst = new Set<string>();

  const candidatesFirst = [
    key[0],
    ...(NEIGHBORS[key[0]] ?? ''),
    ...(currentLexiconLang === 'pt' ? (INITIAL_ALTERNATIVES[key[0]] ?? '') : ''),
    ...(key.length >= 2 ? [key[1]] : []),
  ];

  const maxLenDiff = key.length >= 6 ? 3 : 2;

  for (const first of candidatesFirst) {
    if (!first || triedFirst.has(first)) continue;
    triedFirst.add(first);
    for (const e of index.get(first) ?? []) {
      if (Math.abs(e.key.length - key.length) > maxLenDiff) continue;
      const distance = keyboardDistance(key, e.key, limit);
      if (distance <= limit) hits.push({ e, distance });
    }
  }
  fuzzyCache = { lang: currentLexiconLang, key, hits };
  return hits;
}

/** Palavras que nunca aparecem como sugestão (continuam contando para a "tecla invisível"). */
const NEVER_SUGGEST_BY_LANG: Record<Lang, Set<string>> = {
  pt: new Set([
    'porra', 'caralho', 'merda', 'puta', 'puto', 'foda', 'foder', 'fodido', 'fodeu', 'cacete', 'buceta',
    'viado', 'bosta', 'piroca', 'cu', 'xoxota', 'vagabunda',
  ]),
  en: new Set([
    'fuck', 'fucking', 'fucked', 'fucker', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'bastard',
    'cunt', 'nigger', 'nigga', 'motherfucker', 'whore', 'slut', 'cock', 'tits',
  ]),
  es: new Set([
    'mierda', 'puta', 'puto', 'coño', 'joder', 'cabron', 'cabrón', 'carajo', 'verga', 'pendejo',
    'pendeja', 'culiao', 'chingar', 'chingada', 'marica', 'maricon', 'maricón', 'zorra', 'culo',
  ]),
};

/** Abreviações de conversa → palavra completa (aparece como 1ª sugestão). */
const ABBREVIATIONS_BY_LANG: Record<Lang, Record<string, string>> = {
  pt: {
    vc: 'você', vcs: 'vocês', tb: 'também', tbm: 'também', obg: 'obrigado', obgd: 'obrigado',
    pq: 'porque', q: 'que', blz: 'beleza', msg: 'mensagem', td: 'tudo', hj: 'hoje', cmg: 'comigo',
    ctg: 'contigo', mt: 'muito', mto: 'muito', dps: 'depois', vdd: 'verdade', fds: 'fim de semana',
    qdo: 'quando', qnd: 'quando', tmj: 'tamo junto', pfv: 'por favor', pf: 'por favor', add: 'adicionar',
  },
  en: {
    u: 'you', ur: 'your', pls: 'please', plz: 'please', thx: 'thanks', ty: 'thank you',
    idk: "i don't know", tbh: 'to be honest', btw: 'by the way', omg: 'oh my god',
    imo: 'in my opinion', brb: 'be right back', bc: 'because', cuz: 'because',
    msg: 'message', pic: 'picture', np: 'no problem', yw: "you're welcome",
    asap: 'as soon as possible', tmrw: 'tomorrow',
  },
  es: {
    q: 'que', k: 'que', pq: 'porque', pk: 'porque', xq: 'porque', tmb: 'también', tb: 'también',
    tbien: 'también', xfa: 'por favor', porfa: 'por favor', pf: 'por favor', msg: 'mensaje',
    msj: 'mensaje', bno: 'bueno', dnd: 'donde', vdd: 'verdad', grax: 'gracias', grx: 'gracias',
    ola: 'hola', ntp: 'no te preocupes',
  },
};

/**
 * Como a palavra aparece na tela.
 * Inclui formas de nomes próprios, marcas e Deus maiúsculo.
 */
const DISPLAY_FORMS: Partial<Record<Lang, Record<string, string>>> = {
  en: {
    i: 'I', im: "I'm", ive: "I've", dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't",
    couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", isnt: "isn't", arent: "aren't",
    wasnt: "wasn't", werent: "weren't", wont: "won't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't",
    youre: "you're", youve: "you've", youll: "you'll", theyre: "they're", theyve: "they've", weve: "we've",
    thats: "that's", whats: "what's", theres: "there's", hes: "he's", shes: "she's", aint: "ain't",
  },
};

const displayForm = (word: string): string => {
  if (currentLexiconLang === 'pt') {
    const proper = getProperDisplayForm(word);
    if (proper) return proper;
  }
  const fixed = DISPLAY_FORMS[currentLexiconLang]?.[word];
  if (fixed) return fixed;
  // Palavra aprendida que a pessoa escreve com maiúscula (apelido, nome): "Lindeusa"
  const learned = learnedForm(currentLexiconLang, word);
  return learned && learned.toLowerCase() === word.toLowerCase() && learned !== learned.toLowerCase() ? learned : word;
};

/** Chave da tabela de seguintes: "don't" está lá como "dont". */
const bigramKey = (word: string) => (currentLexiconLang === 'en' ? word.replace(/['’]/g, '') : word);

const WORDS_BY_LANG: Record<Lang, string> = {
  pt: WORDS_PT,
  en: WORDS_EN,
  es: WORDS_ES,
};

const BIGRAMS_BY_LANG: Record<Lang, string> = {
  pt: BIGRAMS_PT,
  en: BIGRAMS_EN,
  es: BIGRAMS_ES,
};

interface Entry {
  word: string;
  key: string;
  rank: number;
}

interface Lexicon {
  /** Entradas em ordem alfabética da chave. */
  sorted: Entry[];
  /** Soma acumulada dos pesos na ordem de `sorted` (para somar faixas em O(1)). */
  cumulative: Float64Array;
  /** Chave → formas reais (mais usada primeiro). Ex.: "e" → ["é", "e"]. */
  byKey: Map<string, Entry[]>;
  /** Palavras reais conhecidas, em minúsculas e originais. */
  words: Set<string>;
}

const weightOf = (rank: number) => 1 / (rank + 50);

let currentLexiconLang: Lang = 'pt';
let lexicon: Lexicon | null = null;
let bigrams: Map<string, Map<string, number>> | null = null;
let seenInSentences: Set<string> | null = null;

const lexiconCache: Partial<Record<Lang, Lexicon>> = {};
const bigramsCache: Partial<Record<Lang, { bigrams: Map<string, Map<string, number>>; seen: Set<string> }>> = {};

/** Monta o índice para o idioma pedido (padrão: o de digitação, que é o idioma do app). */
export function buildLexicon(targetLang?: Lang): void {
  const target = targetLang ?? getTypingLanguage();
  if (lexicon && currentLexiconLang === target) return;

  currentLexiconLang = target;

  if (lexiconCache[target]) {
    lexicon = lexiconCache[target]!;
  } else {
    const list = WORDS_BY_LANG[target].split(' ');
    const byKey = new Map<string, Entry[]>();
    for (let rank = 0; rank < list.length; rank++) {
      const word = list[rank];
      const key = toKey(word);
      const forms = byKey.get(key);
      if (forms && rank > 15 * (forms[0].rank + 20)) continue;
      const entry = { word, key, rank };
      if (forms) forms.push(entry);
      else byKey.set(key, [entry]);
    }

    // Injeta marcas famosas, nomes populares e termos sagrados com alta relevância
    if (target === 'pt') {
      const properEntries: string[] = [
        ...Object.values(ALWAYS_CAPITALIZED),
        ...Object.values(BRAND_NAMES),
        ...Object.values(PEOPLE_NAMES),
      ];
      for (let i = 0; i < properEntries.length; i++) {
        const word = properEntries[i];
        const key = toKey(word);
        const forms = byKey.get(key);
        const rank = 600 + (i % 800);
        const entry = { word, key, rank };
        if (!forms) {
          byKey.set(key, [entry]);
        } else if (!forms.some(f => f.word.toLowerCase() === word.toLowerCase())) {
          forms.push(entry);
        }
      }
    }

    const entries = [...byKey.values()].flat();
    const sorted = entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.rank - b.rank));
    const cumulative = new Float64Array(sorted.length + 1);
    for (let i = 0; i < sorted.length; i++) cumulative[i + 1] = cumulative[i] + weightOf(sorted[i].rank);
    lexicon = {
      sorted,
      cumulative,
      byKey,
      words: new Set(entries.map(e => e.word.toLowerCase()).concat(entries.map(e => e.word))),
    };
    lexiconCache[target] = lexicon;
  }

  if (bigramsCache[target]) {
    bigrams = bigramsCache[target]!.bigrams;
    seenInSentences = bigramsCache[target]!.seen;
  } else {
    bigrams = null;
    seenInSentences = null;
  }
}

// Troca o dicionário junto com o idioma de digitação (mercado novo ou espaço segurado)
onTypingLanguageChange(lang => {
  buildLexicon(lang);
});

function ensureLexicon(): Lexicon | null {
  const desired = getTypingLanguage();
  if (!lexicon || currentLexiconLang !== desired) {
    buildLexicon(desired);
  }
  return lexicon;
}

export const isLexiconReady = () => lexicon !== null;

/** Primeira posição em `sorted` cuja chave é >= `key`. */
function lowerBound(sorted: Entry[], key: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].key < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Faixa [início, fim) das palavras que começam com `prefix` (chave). */
function prefixRange(lex: Lexicon, prefix: string): [number, number] {
  // '￿' escrito como escape: o caractere invisível já se perdeu uma vez ao salvar
  // o arquivo, e aí nenhuma palavra "começava com" o digitado (sem completar nem tecla provável)
  return [lowerBound(lex.sorted, prefix), lowerBound(lex.sorted, prefix + '￿')];
}

function rangeWeight(lex: Lexicon, [start, end]: [number, number]): number {
  return lex.cumulative[end] - lex.cumulative[start];
}

/**
 * log P(próxima letra = `letter` | palavra começa com `prefix`), suavizado.
 * Devolve null quando o dicionário não sabe nada sobre o prefixo.
 */
export function nextLetterLogProb(prefix: string, letter: string): number | null {
  const lex = ensureLexicon();
  if (!lex) return null;
  const p = toKey(prefix);
  const total = rangeWeight(lex, prefixRange(lex, p));
  if (total <= 0) return null;
  const hit = rangeWeight(lex, prefixRange(lex, p + toKey(letter)));
  const smoothing = 0.003;
  return Math.log((hit + smoothing * total) / (total * (1 + ALPHABET.length * smoothing)));
}

/** Palavra conhecida do jeito que foi digitada (ignorando maiúsculas)? */
export function isKnownWord(word: string): boolean {
  const lex = ensureLexicon();
  return !!lex && isKnown(lex, word);
}

/** No dicionário, ou uma palavra que a pessoa já usou o bastante (gíria, apelido, nome de produto). */
function isKnown(lex: Lexicon, word: string): boolean {
  const lower = word.toLowerCase();
  return lex.words.has(lower) || lex.words.has(word) || isLearned(currentLexiconLang, lower);
}

/** Mantém o jeito que a pessoa escreveu, preservando marcas e nomes próprios. */
function matchCase(typed: string, suggestion: string): string {
  // Nomes com capitalização específica
  const proper = getProperDisplayForm(suggestion);
  if (proper) return proper;
  if (ALWAYS_CAPITALIZED[suggestion.toLowerCase()]) return ALWAYS_CAPITALIZED[suggestion.toLowerCase()];
  if (BRAND_NAMES[suggestion.toLowerCase()]) return BRAND_NAMES[suggestion.toLowerCase()];
  if (PEOPLE_NAMES[suggestion.toLowerCase()]) return PEOPLE_NAMES[suggestion.toLowerCase()];

  // Aprendida com maiúscula ("Lindeusa"): sempre como a pessoa escreve
  const learned = learnedForm(currentLexiconLang, suggestion);
  if (learned && learned.toLowerCase() === suggestion.toLowerCase() && learned !== learned.toLowerCase()) return learned;

  if (typed.length > 1 && typed === typed.toUpperCase() && typed !== typed.toLowerCase()) {
    return suggestion.toUpperCase();
  }
  if (typed[0] && typed[0] !== typed[0].toLowerCase()) {
    return suggestion[0].toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

/** Variações a 1 erro de distância (troca, falta, sobra, inversão), com o custo de cada uma. */
function editsOf(key: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (let i = 0; i <= key.length; i++) {
    const head = key.slice(0, i);
    const tail = key.slice(i);
    if (tail) out.push([head + tail.slice(1), 1.8]); // letra a mais
    if (tail.length > 1) out.push([head + tail[1] + tail[0] + tail.slice(2), 1.2]); // letras invertidas
    for (const c of ALPHABET) {
      if (tail && c !== tail[0]) {
        const near = NEIGHBORS[tail[0]]?.includes(c) || PHONETIC_EQUIVALENTS[tail[0]]?.includes(c);
        out.push([head + c + tail.slice(1), near ? 0.9 : 2.5]); // tecla errada / fonética
      }
      out.push([head + c + tail, 1.8]); // letra faltando
    }
  }
  return out;
}

export interface Suggestions {
  /** O que foi digitado não está no dicionário (mostra a palavra "entre aspas"). */
  unknown: boolean;
  /** Até 3 sugestões, a melhor primeiro, já com maiúsculas como a digitada. */
  words: string[];
  /**
   * Correção que entra sozinha ao apertar espaço ou pontuação (é a 1ª de
   * `words`), ou null quando não há certeza suficiente.
   */
  autocorrect: string | null;
  /**
   * A palavra parece duas coladas ("parada" → "para da"): vai à esquerda da barra
   * como opção, e a digitada continua sendo a certa. Nunca entra sozinha (só as
   * frases conhecidas, como "bomdia", que vêm em `autocorrect`).
   */
  split: string | null;
}

type Kind = 'abbr' | 'accent' | 'complete' | 'fix' | 'fuzzy';

interface Candidate {
  word: string;
  score: number;
  kind: Kind;
  /** Quanto a palavra anterior "pede" esta (0 = nada). */
  context: number;
}

/** Peso da frase: cada ponto de força (1–9) da palavra anterior vale isto no placar. */
const CONTEXT_WEIGHT = 0.50;
/** Vantagem mínima da melhor correção sobre a 2ª para corrigir sozinha. */
const AUTOCORRECT_MARGIN = 0.6;

const ONLY_LETTERS = /^[a-zà-öø-ÿ]+(?:-[a-zà-öø-ÿ]+)*$/i;

/** Até esta posição na lista de frequência, a palavra é comum o bastante para corrigir sozinha. */
const COMMON_RANK = 3500;

function loadBigrams(): Map<string, Map<string, number>> {
  if (bigrams) return bigrams;
  if (bigramsCache[currentLexiconLang]) {
    bigrams = bigramsCache[currentLexiconLang]!.bigrams;
    seenInSentences = bigramsCache[currentLexiconLang]!.seen;
    return bigrams;
  }
  const map = new Map<string, Map<string, number>>();
  const raw = BIGRAMS_BY_LANG[currentLexiconLang];
  for (const line of raw.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const next = new Map<string, number>();
    for (const pair of line.slice(tab + 1).split(' ')) {
      const colon = pair.lastIndexOf(':');
      if (colon > 0) next.set(pair.slice(0, colon), Number(pair.slice(colon + 1)) || 1);
    }
    map.set(line.slice(0, tab), next);
  }
  bigrams = map;
  const seen = new Set<string>(map.keys());
  for (const next of map.values()) for (const w of next.keys()) seen.add(w);
  seenInSentences = seen;
  bigramsCache[currentLexiconLang] = { bigrams: map, seen };
  return map;
}

/** Força com que `prev` pede `word` (0 quando não há registro). */
function contextStrength(prev: string | undefined, word: string): number {
  if (!prev) return 0;
  return loadBigrams().get(prev)?.get(word) ?? 0;
}

/** Peso da palavra de duas posições atrás ("vou *ao* mercado": "vou" também pede "mercado"). */
const SKIP_CONTEXT_WEIGHT = 0.25;
/** Cada uso da pessoa vale isto (em log): as palavras dela sobem nas sugestões. */
const USER_FREQ_WEIGHT = 0.6;
/** A palavra já apareceu na conversa (nome do cliente, produto): sobe um pouco. */
const RECENT_BOOST = 1.0;

/**
 * Contexto da frase para uma candidata: a palavra anterior (dicionário + o jeito
 * da pessoa escrever), a de duas posições atrás e o que já foi escrito na conversa.
 */
function phraseContext(
  word: string,
  prev: string | undefined,
  contextWords: string[] | undefined,
  recent: Set<string> | undefined,
): { context: number; bonus: number } {
  const lang = currentLexiconLang;
  const userPairs = Math.min(9, pairCount(lang, prev, word) * 2);
  const context = contextStrength(prev, word) + userPairs;
  const n = contextWords?.length ?? 0;
  const prev2 = n >= 2 ? bigramKey(contextWords![n - 2]) : undefined;
  let bonus = SKIP_CONTEXT_WEIGHT * contextStrength(prev2, word);
  bonus += USER_FREQ_WEIGHT * Math.log1p(userCount(lang, word));
  if (recent?.has(word)) bonus += RECENT_BOOST;
  return { context, bonus };
}

/**
 * Detecta quando duas palavras foram digitadas coladas sem espaço
 * ("bomdia" → "bom dia", "bndia" → "bom dia", "comovai" → "como vai",
 * "deusabencoe" → "Deus abençoe", "chavepix" → "chave Pix", etc.).
 */
function findSplitWordCandidate(
  lex: Lexicon,
  typed: string,
  prev?: string,
  contextWords?: string[],
  /** Só as duas partes exatas, sem procurar erro de digitação nelas (palavra que já existe). */
  exact = false,
): { text: string; score: number } | null {
  if (typed.length < 5) return null;
  const key = toKey(typed);

  // 1. Frases comuns pré-mapeadas
  const common = COMMON_SPLIT_PHRASES[key];
  if (common) {
    return { text: common, score: 38 };
  }

  // 2. Busca dinâmica por divisão em 2 palavras
  let bestCandidate: { text: string; score: number } | null = null;
  const n = key.length;

  const VALID_2_LETTER = new Set(['de', 'em', 'se', 'me', 'te', 'eu', 'tu', 'na', 'no', 'um', 'ja', 'so', 'la', 'da', 'do', 'ou', 'ir', 'vi', 'va']);
  const bigramMap = loadBigrams();

  for (let i = 2; i <= n - 2; i++) {
    const p1Key = key.slice(0, i);
    const p2Key = key.slice(i);

    if (p1Key.length === 2 && !VALID_2_LETTER.has(p1Key)) continue;
    if (p2Key.length === 2 && !VALID_2_LETTER.has(p2Key)) continue;

    // Busca correspondência para a primeira palavra
    let w1Entries = lex.byKey.get(p1Key);
    let p1Cost = 0;
    if (!w1Entries && !exact && p1Key.length >= 3) {
      for (const [cand, cost] of editsOf(p1Key)) {
        const e = lex.byKey.get(cand);
        if (e && e[0].rank <= 3000) {
          w1Entries = e;
          p1Cost = cost;
          break;
        }
      }
    }
    if (!w1Entries || w1Entries.length === 0) continue;

    // Busca correspondência para a segunda palavra
    let w2Entries = lex.byKey.get(p2Key);
    let p2Cost = 0;
    if (!w2Entries && !exact && p2Key.length >= 3) {
      for (const [cand, cost] of editsOf(p2Key)) {
        const e = lex.byKey.get(cand);
        if (e && e[0].rank <= 3000) {
          w2Entries = e;
          p2Cost = cost;
          break;
        }
      }
    }
    if (!w2Entries || w2Entries.length === 0) continue;

    const e1 = w1Entries[0];
    const e2 = w2Entries[0];

    if (e1.rank > 14000 || e2.rank > 14000) continue;

    const bigramStrength = bigramMap.get(e1.word)?.get(e2.word) ?? 0;
    const contextStrengthW1 = prev ? (bigramMap.get(prev)?.get(e1.word) ?? 0) : 0;
    const collocBoost = contextWords ? getCollocationBoost(contextWords, e1.word) : 0;

    let score = 22 - Math.log(e1.rank + 10) - Math.log(e2.rank + 10);
    score -= (p1Cost + p2Cost) * 1.8;
    score += bigramStrength * 1.6;
    score += contextStrengthW1 * 0.8;
    score += collocBoost;

    // Se houve erro nas duas partes e sem bigrama conhecido, descarta
    if (p1Cost > 0 && p2Cost > 0 && bigramStrength === 0) continue;

    if (!bestCandidate || score > bestCandidate.score) {
      const t1 = displayForm(e1.word);
      const t2 = displayForm(e2.word);
      bestCandidate = { text: `${t1} ${t2}`, score };
    }
  }

  if (bestCandidate && bestCandidate.score >= 5.0) {
    return bestCandidate;
  }
  return null;
}

/** Palavra aprendida vale como uma do dicionário: mais usada = mais comum. */
const learnedFreq = (count: number) => Math.log(weightOf(Math.max(30, 4000 / count)));

/**
 * Palavras coladas: a separação vai à esquerda da barra, sem trocar a palavra
 * sozinha. Se a digitada já é uma palavra ("parada", "sutilmente"), só mostra a
 * separação quando ela é bem provável (placar mais alto).
 */
function splitSuggestion(
  lex: Lexicon,
  typed: string,
  known: boolean,
  prev?: string,
  contextWords?: string[],
): string | null {
  if (currentLexiconLang !== 'pt' || toKey(typed).length < 5 || isLearned(currentLexiconLang, typed)) return null;
  const curated = COMMON_SPLIT_PHRASES[toKey(typed)];
  if (curated) return curated;
  const cand = findSplitWordCandidate(lex, typed, prev, contextWords, known);
  if (!cand || cand.score < (known ? KNOWN_SPLIT_MIN_SCORE : 5)) return null;
  return matchCase(typed, cand.text);
}

/** Placar mínimo para sugerir separar uma palavra que já existe. */
const KNOWN_SPLIT_MIN_SCORE = 9;

/** Todas as candidatas para `typed`, com placar, origem e contexto expandido. */
function candidatesFor(
  lex: Lexicon,
  typed: string,
  prev?: string,
  fuzzy = true,
  contextWords?: string[],
  recent?: Set<string>,
): Candidate[] {
  const lowerTyped = typed.toLowerCase();
  const key = toKey(typed);
  const known = isKnown(lex, typed);
  const found = new Map<string, Candidate>();
  const neverSuggest = NEVER_SUGGEST_BY_LANG[currentLexiconLang] ?? NEVER_SUGGEST_BY_LANG.pt;
  const abbreviations = ABBREVIATIONS_BY_LANG[currentLexiconLang] ?? ABBREVIATIONS_BY_LANG.pt;

  const offer = (word: string, base: number, kind: Kind) => {
    if (word === lowerTyped || neverSuggest.has(word)) return;
    const { context, bonus } = phraseContext(word, prev, contextWords, recent);
    const colloc = contextWords && currentLexiconLang === 'pt' ? getCollocationBoost(contextWords, word) : 0;
    const score = base + CONTEXT_WEIGHT * context + colloc + bonus;
    const old = found.get(word);
    if (!old || score > old.score) found.set(word, { word, score, kind, context });
  };
  const learned = learnedWords(currentLexiconLang);
  const freq = (e: Entry) => Math.log(weightOf(e.rank));

  // 0) Abreviação de conversa (só na barra, nunca sozinha)
  const expanded = abbreviations[lowerTyped];
  if (expanded) offer(expanded, 100, 'abbr');

  // 0.5) Expressões coladas conhecidas ("bomdia" → "bom dia"): só quando a digitada não é uma palavra
  if (currentLexiconLang === 'pt' && !known) {
    const commonSplit = COMMON_SPLIT_PHRASES[key];
    if (commonSplit) {
      found.set(commonSplit, {
        word: commonSplit,
        score: 42,
        kind: 'fix',
        context: 0,
      });
    }
  }

  // 1) Mesma palavra com acento: "voce" → "você", "nao" → "não"
  for (const e of lex.byKey.get(key) ?? []) offer(e.word, freq(e) + (known ? 0.5 : 4), 'accent');

  // 2) Completar a palavra (as mais usadas que começam assim)
  const [start, end] = prefixRange(lex, key);
  const best: Entry[] = [];
  for (let i = start; i < end; i++) {
    const e = lex.sorted[i];
    if (e.key.length === key.length) continue;
    if (best.length < 8) {
      best.push(e);
      best.sort((a, b) => a.rank - b.rank);
    } else if (e.rank < best[7].rank) {
      best[7] = e;
      best.sort((a, b) => a.rank - b.rank);
    }
  }
  // A frase anterior também ajuda a completar
  if (prev) {
    for (const [word] of loadBigrams().get(prev) ?? []) {
      const forms = lex.byKey.get(toKey(word));
      const e = forms?.find(f => f.word === word);
      if (e && e.key.startsWith(key) && e.key.length > key.length && !best.includes(e)) best.push(e);
    }
  }
  for (const e of best) offer(e.word, freq(e) - 0.15 * (e.key.length - key.length), 'complete');

  // 2.5) Palavras da pessoa (gírias, apelidos, produtos) que começam assim
  for (const l of learned) {
    const lk = toKey(l.key);
    if (lk.length > key.length && lk.startsWith(key)) offer(l.key, learnedFreq(l.count) - 0.15 * (lk.length - key.length), 'complete');
  }

  // 3) Corrigir erro de digitação (só se a palavra não existe)
  if (!known && key.length >= 2) {
    for (const [candidate, cost] of editsOf(key)) {
      const forms = lex.byKey.get(candidate);
      if (forms) for (const e of forms) offer(e.word, freq(e) - cost + 1, 'fix');
    }
    // Também perto de uma palavra da pessoa ("Lindeisa" → "Lindeusa")
    if (key.length >= 3) {
      const limit = fuzzyLimit(key.length);
      for (const l of learned) {
        const lk = toKey(l.key);
        if (lk === key || Math.abs(lk.length - key.length) > 2) continue;
        const distance = keyboardDistance(key, lk, limit);
        if (distance <= limit) offer(l.key, learnedFreq(l.count) - FUZZY_DISTANCE_WEIGHT * distance + 4, 'fuzzy');
      }
    }
  }

  // 4) Erro de várias letras ou muito errada ("wetrndo" → "querendo", "geito" → "jeito"):
  // busca ampla pelo teclado e fonética
  const hasFix = [...found.values()].some(c => (c.kind === 'fix' && !c.word.includes(' ')) || c.kind === 'accent');
  if (fuzzy && !known && !hasFix && key.length >= FUZZY_MIN_LENGTH) {
    for (const { e, distance } of fuzzyMatches(lex, key)) {
      offer(e.word, FUZZY_FREQ_WEIGHT * freq(e) - FUZZY_DISTANCE_WEIGHT * distance + 4, 'fuzzy');
    }
  }
  return [...found.values()].sort((a, b) => b.score - a.score);
}

/**
 * Sugestões para a palavra que está sendo digitada.
 * `prevWord`: palavra anterior da frase ("^" no começo da frase).
 * `contextWords`: as últimas palavras da oração (até 12), para concordância e contexto.
 * `recentWords`: palavras já escritas na conversa (nomes, produtos), que sobem um pouco.
 */
export function suggest(
  typed: string,
  limit = 3,
  prevWord?: string,
  fast = false,
  contextWords?: string[],
  recentWords?: string[],
): Suggestions {
  const lex = ensureLexicon();
  const prev = prevWord && bigramKey(prevWord);
  if (!lex || !typed) return { unknown: false, words: [], autocorrect: null, split: null };

  const lowerTyped = typed.toLowerCase();

  // Regra absoluta para "deus" em português: SEMPRE "Deus" com D maiúsculo
  if (currentLexiconLang === 'pt' && lowerTyped === 'deus') {
    return { unknown: false, words: ['Deus'], autocorrect: 'Deus', split: null };
  }
  if (currentLexiconLang === 'pt' && lowerTyped === 'deuses') {
    return { unknown: false, words: ['Deuses'], autocorrect: 'Deuses', split: null };
  }

  const recent = recentWords?.length ? new Set(recentWords) : undefined;
  const known = isKnown(lex, typed);
  const all = candidatesFor(lex, typed, prev, !fast, contextWords, recent);
  const fix = pickAutocorrect(lex, typed, known, all, prev, contextWords);

  // A correção automática vai na frente (é a que aparece em destaque)
  const ordered = fix ? [fix, ...all.filter(c => c !== fix)] : all;

  // Nomes próprios e marcas (ex.: WhatsApp, iPhone, Pix, Deus) ou contrações
  const proper = displayForm(lowerTyped);
  const form = proper !== lowerTyped ? proper : DISPLAY_FORMS[currentLexiconLang]?.[lowerTyped];
  const autocorrect = fix
    ? matchCase(typed, displayForm(fix.word))
    : form && form !== typed
    ? matchCase(typed, form)
    : null;

  // Separação de palavras coladas: opção à esquerda, nunca no lugar da palavra.
  // Se a palavra só precisava de acento ou de uma letra ("amanha" → "amanhã"), não há o que separar
  const splitText = !fix || fix.word.includes(' ') ? splitSuggestion(lex, typed, known, prev, contextWords) : null;
  const split = splitText && splitText !== autocorrect ? splitText : null;

  const shown = ordered.map(c => matchCase(typed, displayForm(c.word)));
  const words = [...new Set(autocorrect ? [autocorrect, ...shown] : shown)]
    .filter(w => w !== typed && w !== split)
    .slice(0, limit);
  return {
    unknown: !known && words.length > 0,
    words,
    autocorrect,
    split,
  };
}

/** Usos para a pessoa "costumar" escrever de um jeito (ver userWords). */
const LEARNED_MIN = 2;

/**
 * Acento pelo contexto numa palavra que existe com e sem acento ("pao/pão",
 * "esta/está", "e/é"): só troca quando a frase pede claramente a acentuada ou
 * quando ela é muito mais comum, e nunca se a pessoa costuma escrever sem acento.
 */
function contextualAccent(lex: Lexicon, typed: string, prev?: string, contextWords?: string[]): Candidate | null {
  const lower = typed.toLowerCase();
  const key = toKey(typed);
  if (key !== lower) return null; // já tem acento
  const forms = lex.byKey.get(key);
  if (!forms || forms.length < 2) return null;
  const typedRank = forms.find(f => f.word === lower)?.rank ?? Infinity;
  const lang = currentLexiconLang;
  const typedUse = userCount(lang, lower);
  let best: Candidate | null = null;
  for (const f of forms) {
    if (f.word === lower || toKey(f.word) !== key) continue;
    if (typedUse >= LEARNED_MIN && typedUse > userCount(lang, f.word)) return null;
    const ctxA = phraseContext(f.word, prev, contextWords, undefined).context;
    const ctxT = phraseContext(lower, prev, contextWords, undefined).context;
    // As duas formas muito usadas (esta/está, nos/nós): só pelo contexto da frase.
    // "e/é" pede contexto bem forte ("isso é"): "ele e ela" é comum demais
    const bothCommon = f.rank < 600 && typedRank < 600;
    const byContext = ctxA - ctxT >= (key.length === 1 ? 4 : 2);
    const byFrequency = !bothCommon && ctxA >= ctxT && typedRank >= f.rank * 8;
    if (!byContext && !byFrequency) continue;
    const score = ctxA - ctxT + Math.log(typedRank / f.rank);
    if (!best || score > best.score) best = { word: f.word, score, kind: 'accent', context: ctxA };
  }
  return best;
}

/**
 * Correção automática: quando a palavra digitada não existe, não é abreviação
 * e a melhor correção ganha com folga das outras. Palavra que existe só ganha
 * acento pelo contexto. A separação de palavras coladas nunca entra sozinha
 * (só as frases conhecidas, como "bomdia").
 */
function pickAutocorrect(
  lex: Lexicon,
  typed: string,
  known: boolean,
  all: Candidate[],
  prev?: string,
  contextWords?: string[],
): Candidate | null {
  if (!typed || !ONLY_LETTERS.test(typed)) return null;
  if (known) return isLearned(currentLexiconLang, typed) ? null : contextualAccent(lex, typed, prev, contextWords);
  if (typed.length < 2) return null;
  const abbreviations = ABBREVIATIONS_BY_LANG[currentLexiconLang] ?? ABBREVIATIONS_BY_LANG.pt;
  if (abbreviations[typed.toLowerCase()]) return null;
  const typedLength = toKey(typed).length;
  loadBigrams();
  const curatedSplit = COMMON_SPLIT_PHRASES[toKey(typed)];
  const fixes = all.filter(c => {
    // Só as frases coladas conhecidas ("bom dia") entram sozinhas
    if (c.word.includes(' ')) return c.word === curatedSplit;
    // Palavra da pessoa bem perto do digitado ("Lindeisa" → "Lindeusa")
    if (isLearned(currentLexiconLang, c.word)) return c.kind === 'fuzzy' || c.kind === 'fix';
    const rank = lex.byKey.get(toKey(c.word))?.find(e => e.word === c.word)?.rank ?? Infinity;
    if (rank > COMMON_RANK && !seenInSentences?.has(c.word)) return false;
    if (c.kind === 'accent' || c.kind === 'fix' || c.kind === 'fuzzy') return true;
    // Faltou só a última letra: "obrigad" → "obrigado"
    return c.kind === 'complete' && toKey(c.word).length === typedLength + 1;
  });
  const best = fixes[0];
  if (!best) return null;
  // Acento ou frase colada conhecida é certeiro
  if (best.kind === 'accent' || best.word.includes(' ')) return best;
  // Rival que só muda a última letra não trava: vale a mais comum
  const stem = (w: string) => toKey(w).slice(0, -1);
  const rival = fixes.slice(1).find(c => stem(c.word) !== stem(best.word));
  // Erro de várias letras: só corrige sozinho com folga maior sobre a 2ª
  const margin = best.kind === 'fuzzy' ? FUZZY_MARGIN : AUTOCORRECT_MARGIN;
  if (rival && best.score - rival.score < margin && best.context <= rival.context) return null;
  return best;
}

/**
 * A busca ampla pode mudar as sugestões desta palavra?
 */
export function needsFullSuggest(typed: string, prevWord?: string, contextWords?: string[]): boolean {
  const lex = ensureLexicon();
  if (!lex || typed.length < FUZZY_MIN_LENGTH || isKnown(lex, typed)) return false;
  const prev = prevWord && bigramKey(prevWord);
  return !candidatesFor(lex, typed, prev, false, contextWords).some(
    c => (c.kind === 'fix' && !c.word.includes(' ')) || c.kind === 'accent',
  );
}

/**
 * Próximas palavras prováveis depois de `prev` (após o espaço): o jeito da
 * pessoa escrever primeiro, depois as frases conhecidas e as combinações da
 * língua, pesando também a palavra de duas posições atrás e a conversa.
 */
export function predictNext(prev: string, limit = 3, contextWords?: string[], recentWords?: string[]): string[] {
  const lex = ensureLexicon();
  if (!lex) return [];
  const results: string[] = [];
  const seen = new Set<string>();
  const neverSuggest = NEVER_SUGGEST_BY_LANG[currentLexiconLang] ?? NEVER_SUGGEST_BY_LANG.pt;
  const push = (w: string) => {
    if (neverSuggest.has(w.toLowerCase())) return;
    const form = displayForm(w);
    if (seen.has(form.toLowerCase())) return;
    seen.add(form.toLowerCase());
    results.push(form);
  };

  // 1. O que a pessoa costuma escrever depois desta palavra
  if (prev !== '^') for (const w of nextFromPairs(currentLexiconLang, bigramKey(prev)).slice(0, 2)) push(w);

  // 2. Predições contextuais avançadas pelo histórico da oração
  if (currentLexiconLang === 'pt' && contextWords && contextWords.length > 0) {
    for (const w of getContextualNextPredictions(contextWords)) push(w);
  }

  // 3. Combinações da língua, com a palavra de duas posições atrás e a conversa
  const next = loadBigrams().get(bigramKey(prev));
  if (next && results.length < limit) {
    const recent = recentWords?.length ? new Set(recentWords) : undefined;
    const scored = [...next.entries()].map(([w, strength]) => {
      const { bonus } = phraseContext(w, undefined, contextWords, recent);
      return [w, strength + bonus] as const;
    });
    scored.sort((a, b) => b[1] - a[1]);
    for (const [w] of scored) {
      push(w);
      if (results.length >= limit) break;
    }
  }

  return results.slice(0, limit);
}

/** Mantém maiúsculas como a pessoa digitou (para quem aplica a correção). */
export { matchCase };
