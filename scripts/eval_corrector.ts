/**
 * Mede o corretor com erros de digitação simulados sobre palavras comuns:
 * tecla vizinha, letra faltando, letra a mais (vizinha) e letras invertidas,
 * 1 a 3 erros por palavra. Mostra, por idioma e por número de erros:
 *  - acerto: a palavra certa é a 1ª sugestão;
 *  - na barra: está entre as 3 sugestões;
 *  - corrige: a correção automática (ao apertar espaço) acerta;
 *  - erra: a correção automática troca por OUTRA palavra (o pior caso).
 * Também mede o tempo por consulta.
 *
 * Uso: npx tsx scripts/eval_corrector.ts [quantas palavras por idioma, padrão 400]
 */
import { setLanguage, setSellingLanguage } from '../src/i18n';
import type { Lang } from '../src/i18n';
import { buildLexicon, suggest } from '../src/keyboard/typing/lexicon';
import { WORDS_EN } from '../src/keyboard/typing/wordsEn';
import { WORDS_ES } from '../src/keyboard/typing/wordsEs';
import { WORDS_PT } from '../src/keyboard/typing/wordsPt';

const NEIGHBORS: Record<string, string> = {
  q: 'wa', w: 'qeas', e: 'wrsd', r: 'etdf', t: 'ryfg', y: 'tugh', u: 'yihj', i: 'uojk', o: 'ipkl', p: 'ol',
  a: 'qwsz', s: 'awedxz', d: 'serfcx', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb', j: 'huikmn', k: 'jiolm', l: 'kop',
  z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb', b: 'vghn', n: 'bhjm', m: 'njk',
};

// Sorteio repetível (mesmas palavras e erros a cada execução)
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(list: T[] | string) => list[Math.floor(rand() * list.length)];

const plain = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Um erro de digitação típico, sempre mudando a palavra. */
function typo(word: string): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const i = Math.floor(rand() * word.length);
    const c = word[i];
    const r = rand();
    let out = word;
    if (r < 0.55 && NEIGHBORS[c]) out = word.slice(0, i) + pick(NEIGHBORS[c]) + word.slice(i + 1);
    else if (r < 0.75 && word.length > 3) out = word.slice(0, i) + word.slice(i + 1);
    else if (r < 0.9 && NEIGHBORS[c]) out = word.slice(0, i + 1) + pick(NEIGHBORS[c]) + word.slice(i + 1);
    else if (i < word.length - 1) out = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    if (out !== word) return out;
  }
  return word;
}

const perLang = Number(process.argv[2]) || 400;
const lists: Record<Lang, string> = { pt: WORDS_PT, en: WORDS_EN, es: WORDS_ES };

for (const lang of ['pt', 'en', 'es'] as Lang[]) {
  setSellingLanguage(lang);
  setLanguage(lang);
  buildLexicon();
  // Palavras comuns de 5 a 10 letras, sem acento (o teste compara sem acento)
  const pool = lists[lang]
    .split(' ')
    .slice(150, 6000)
    .filter(w => /^[a-z]{5,10}$/.test(w));
  const words = Array.from({ length: perLang }, () => pick(pool));
  for (const errors of [1, 2, 3]) {
    let top1 = 0;
    let inBar = 0;
    let fixed = 0;
    let wrong = 0;
    let total = 0;
    let ms = 0;
    for (const word of words) {
      let typed = word;
      for (let k = 0; k < errors; k++) typed = typo(typed);
      if (typed === word) continue;
      total++;
      const t0 = performance.now();
      const r = suggest(typed, 3);
      ms += performance.now() - t0;
      const ws = r.words.map(w => plain(w.toLowerCase()));
      if (ws[0] === word) top1++;
      if (ws.includes(word)) inBar++;
      if (r.autocorrect) {
        if (plain(r.autocorrect.toLowerCase()) === word) fixed++;
        else wrong++;
      }
    }
    const pct = (n: number) => `${Math.round((100 * n) / total)}%`.padStart(4);
    console.log(
      `${lang} ${errors} erro(s): acerto ${pct(top1)} | na barra ${pct(inBar)} | corrige ${pct(fixed)} | erra ${pct(wrong)} | ${(ms / total).toFixed(1)} ms`,
    );
  }
}
