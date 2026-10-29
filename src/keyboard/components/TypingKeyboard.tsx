import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, NativeTouchEvent } from 'react-native';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { InputContext } from '../../native/KeyboardBridge';
import { makeStyles, onCoralText, radius, useColors } from '../theme';
import { buildLexicon, needsFullSuggest, predictNext, suggest } from '../typing/lexicon';
import { resolveLetter } from '../typing/keyResolver';
import type { KeyRect } from '../typing/keyResolver';
import { TypingContext } from '../typing/typingContext';
import { createDeleteRepeater } from '../utils/deleteRepeater';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { LANGUAGES, getTypingLanguage, t, nextTypingLanguage, onTypingLanguageChange, setTypingLanguage } from '../../i18n';
import type { Lang } from '../../i18n';
import { useLanguage } from '../../i18n/useLanguage';
import { EmojiPanel } from './EmojiPanel';
import { SuggestionBar } from './SuggestionBar';
import type { SuggestionBarHandle, SuggestionItem } from './SuggestionBar';

/**
 * Teclado de digitação próprio (QWERTY pt-BR).
 *
 * Toques: um único "ouvinte" cobre todas as teclas e acompanha cada dedo
 * separadamente. Antes cada tecla era um botão, e o React Native só deixa um
 * botão "dono" do toque por vez: digitando rápido, a tecla seguinte era
 * apertada antes de soltar a anterior e se perdia. Agora:
 *  - um toque novo confirma na hora a tecla anterior que ainda estava presa
 *    (ordem garantida, nada se perde);
 *  - a tecla é decidida pelo ponto onde o dedo encostou, com a "tecla
 *    invisível" ajustada pela palavra (ver typing/keyResolver);
 *  - as teclas não se redesenham a cada letra (só a barra de sugestões e o
 *    destaque da tecla apertada).
 *
 * Modos: letras, números (?123) e símbolos (=\<). Shift: um toque = próxima
 * letra maiúscula; dois toques rápidos = caps lock. Maiúscula automática no
 * começo da mensagem e depois de . ! ?. Nos números e símbolos o teclado
 * continua neles; o apóstrofo e o espaço voltam para as letras. Dois espaços
 * seguidos viram ". ". 😊 abre os emojis (ao lado da vírgula).
 * Segurar uma vogal (ou c/n) abre os acentos acima da tecla: arraste o dedo
 * até o escolhido e solte (soltar fecha a opção); o "ç" fica no "c".
 *
 * Corretor: as sugestões levam em conta a palavra anterior da frase; logo
 * depois do espaço aparecem as próximas palavras prováveis. Ao apertar espaço
 * ou pontuação com uma palavra errada, ela é corrigida sozinha; ⌫ logo em
 * seguida desfaz a correção (e o teclado não insiste naquela palavra). Segurar ⌫ apaga continuamente.
 */

type Mode = 'alpha' | 'numeric' | 'symbols';
type ShiftState = 'off' | 'once' | 'lock';

const ROWS: Record<Mode, [string[], string[], string[]]> = {
  alpha: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    // Sem "ç": fica ao segurar o "c" (ACCENTS). A fileira fica centralizada (ver rowInset)
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ],
  numeric: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'],
    ['*', '"', "'", ':', ';', '!', '?'],
  ],
  symbols: [
    ['~', '`', '|', '^', '_', '=', '{', '}', '[', ']'],
    ['<', '>', '€', '£', '¥', '¢', '§', '°', '«', '»'],
    ['·', '©', '®', '™', '¶', '¿', '¡'],
  ],
};

const ACCENTS: Record<string, string[]> = {
  a: ['á', 'à', 'â', 'ã', 'ä'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['í', 'ì', 'î', 'ï'],
  o: ['ó', 'ò', 'ô', 'õ', 'ö'],
  u: ['ú', 'ù', 'û', 'ü'],
  c: ['ç'],
  n: ['ñ'],
};

type KeyAction =
  | { t: 'char'; v: string }
  | { t: 'shift' }
  | { t: 'delete' }
  | { t: 'mode'; to: Mode }
  | { t: 'space' }
  | { t: 'emoji' }
  | { t: 'enter' };

type KeyKind = 'char' | 'func' | 'space' | 'enter';

interface KeyDef {
  id: string;
  label: string;
  icon?: IconName;
  kind: KeyKind;
  flex: number;
  action: KeyAction;
  /** Letra base (minúscula) — usada pela "tecla invisível" e pelos acentos. */
  letter?: string;
}

/** Largura de toda fileira, em teclas: a mais cheia (q…p) tem 10. */
const ROW_UNITS = 10;

/**
 * Respiro de cada lado de uma fileira mais curta, em teclas (a…l: 9 teclas →
 * meia tecla de cada lado), para as teclas ficarem centralizadas e do mesmo
 * tamanho das de cima.
 */
function rowInset(row: KeyDef[]): number {
  const total = row.reduce((sum, k) => sum + k.flex, 0);
  return total < ROW_UNITS ? (ROW_UNITS - total) / 2 : 0;
}

/** Espaço entre as linhas de teclas (teclas retangulares, como no teclado do Android). */
const ROW_GAP = 9;
const KEY_GAP = 5;
const LONG_PRESS_MS = 350;
/** Dois toques no shift dentro deste tempo travam as maiúsculas. */
const DOUBLE_TAP_MS = 350;
const DOUBLE_SPACE_MS = 450;
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;
/** Trava de segurança: nenhuma repetição do ⌫ dura mais que isso. */
const MAX_REPEAT_MS = 30_000;
/** Pontuação que "puxa" o espaço automático da sugestão ("palavra ." → "palavra. "). */
const SNAP_PUNCTUATION = '.,!?;:';

/** Dedos que mudaram; no mouse (versão web no computador) o próprio evento. */
function pointsOf(e: GestureResponderEvent): NativeTouchEvent[] {
  const changed = e.nativeEvent.changedTouches;
  return changed && changed.length ? Array.from(changed) : [e.nativeEvent];
}

const isLetter = (c: string) => /^[a-zà-ÿç]$/i.test(c);

/** Segurar o espaço por este tempo troca o idioma de digitação. */
const LANGUAGE_HOLD_MS = 500;

function buildRows(mode: Mode, shift: ShiftState, typingLang: Lang): KeyDef[][] {
  const upper = mode === 'alpha' && shift !== 'off';
  const charKey = (c: string): KeyDef => {
    const v = upper ? c.toUpperCase() : c;
    return { id: `c:${c}`, label: v, kind: 'char', flex: 1, action: { t: 'char', v }, letter: isLetter(c) ? c : undefined };
  };
  const [r1, base2, r3] = ROWS[mode];
  // Espanhol: "ñ" na ponta da 2ª fileira, como nos teclados de lá
  const r2 = mode === 'alpha' && typingLang === 'es' ? [...base2, 'ñ'] : base2;
  const third: KeyDef =
    mode === 'alpha'
      ? { id: 'shift', label: '⇧', icon: shift === 'lock' ? 'capsLock' : 'shift', kind: 'func', flex: 1.5, action: { t: 'shift' } }
      : {
          id: 'mode-sym',
          label: mode === 'numeric' ? '=\\<' : '?123',
          kind: 'func',
          flex: 1.5,
          action: { t: 'mode', to: mode === 'numeric' ? 'symbols' : 'numeric' },
        };
  return [
    r1.map(charKey),
    r2.map(charKey),
    [third, ...r3.map(charKey), { id: 'delete', label: '⌫', icon: 'apagar', kind: 'func', flex: 1.5, action: { t: 'delete' } }],
    [
      {
        id: 'mode-main',
        label: mode === 'alpha' ? '?123' : 'ABC',
        kind: 'func',
        flex: 1.5,
        action: { t: 'mode', to: mode === 'alpha' ? 'numeric' : 'alpha' },
      },
      { id: 'comma', label: ',', kind: 'char', flex: 1, action: { t: 'char', v: ',' } },
      // Emojis (painel com os emojis do próprio celular)
      { id: 'emoji', label: '😊', icon: 'emoji', kind: 'func', flex: 1, action: { t: 'emoji' } },
      // O nome do idioma de digitação no espaço (segurar troca)
      { id: 'space', label: LANGUAGES.find(l => l.id === typingLang)?.label ?? '', kind: 'space', flex: 4, action: { t: 'space' } },
      { id: 'dot', label: '.', kind: 'char', flex: 1, action: { t: 'char', v: '.' } },
      { id: 'enter', label: '↵', icon: 'enter', kind: 'enter', flex: 1.5, action: { t: 'enter' } },
    ],
  ];
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ActiveTouch {
  key: KeyDef;
  /** Já agiu (shift/⌫ agem ao encostar; letras ao soltar ou no toque seguinte). */
  done: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** Segurando uma letra: opções de acento abertas acima dela. */
  accent?: AccentSession;
}

interface AccentSession {
  options: string[];
  /** Opção sob o dedo (0 = a própria letra). */
  index: number;
  /** Onde começa a fileira de opções e a largura de cada uma (área das teclas). */
  x0: number;
  optW: number;
}

/** Última correção automática, para o ⌫ logo em seguida desfazer. */
interface LastFix {
  original: string;
  fixed: string;
  /** O que entrou depois da palavra (espaço ou pontuação). */
  trail: string;
}

/**
 * Para onde vai o que é digitado. Padrão: o campo do app em foco (WhatsApp...).
 * Os formulários do teclado (CRM, agenda) passam o próprio campo: o teclado do
 * sistema não pode usar TextInput sem roubar o foco da conversa.
 */
export interface TextSink {
  insertText(text: string): Promise<boolean>;
  /** false = não havia nada para apagar (para a repetição do ⌫). */
  deleteBackward(): Promise<boolean>;
  replaceTextBeforeCursor(count: number, text: string): Promise<boolean>;
  sendEnter(): Promise<boolean>;
  getInputContext(): Promise<InputContext>;
}

interface Props {
  /** Sem sink, digita no app em foco. */
  sink?: TextSink;
  /** Campo de número (preço, telefone): abre já nos números. */
  initialMode?: 'alpha' | 'numeric';
}

export function TypingKeyboard({ sink, initialMode = 'alpha' }: Props = {}) {
  const styles = useStyles();
  // Lido nos toques (fora do ciclo do React): sempre o sink atual
  const out = useRef<TextSink>(sink ?? KeyboardBridge);
  out.current = sink ?? KeyboardBridge;
  const internal = !!sink;
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [shift, setShiftState] = useState<ShiftState>('off');

  // Os toques chegam fora do ciclo do React: o estado atual fica também em refs
  const modeRef = useRef<Mode>(initialMode);
  const shiftRef = useRef<ShiftState>('off');
  const lastShiftTap = useRef(0);
  const lastSpaceAt = useRef(0);
  /** A sugestão escolhida acabou de inserir um espaço automático. */
  const autoSpace = useRef(false);
  const lastFix = useRef<LastFix | null>(null);
  /** Palavras que a pessoa desfez a correção: não corrige de novo (nesta sessão). */
  const keepAsTyped = useRef(new Set<string>());

  const setMode = useCallback((m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  }, []);
  const setShift = useCallback((s: ShiftState) => {
    shiftRef.current = s;
    setShiftState(s);
  }, []);

  useLanguage();
  const [typingLang, setTypingLang] = useState<Lang>(getTypingLanguage);
  useEffect(() => onTypingLanguageChange(setTypingLang), []);
  const rows = useMemo(() => buildRows(mode, shift, typingLang), [mode, shift, typingLang]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const suggestionBar = useRef<SuggestionBarHandle>(null);
  const feedback = useRef<PressFeedbackHandle>(null);
  const accentPopup = useRef<AccentPopupHandle>(null);

  /** Depois de cada edição: maiúscula automática + sugestões da palavra atual. */
  const refresh = useRef(() => {});
  /** Sugestões completas (com a busca ampla) pedidas para depois da tecla. */
  const fullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fullTimer.current) clearTimeout(fullTimer.current);
  }, []);
  const [context] = useState(
    () => new TypingContext(() => refresh.current(), () => out.current.getInputContext()),
  );
  refresh.current = () => {
    const sentenceStart = context.atSentenceStart();
    if (shiftRef.current !== 'lock') setShift(sentenceStart ? 'once' : 'off');
    // Campo vazio (nova mensagem ou campo limpo após envio): garante retorno ao teclado de letras
    if (modeRef.current === 'symbols' && context.lastChar() === '' && !context.currentWord()) {
      setMode('alpha');
    }
    if (!context.allowsSuggestions()) {
      suggestionBar.current?.show([]);
      return;
    }
    const word = context.currentWord();
    const prev = context.previousWord();
    const contextWords = context.previousWords(5);
    if (!word) {
      // Logo depois do espaço (ou no começo): as próximas palavras prováveis
      const last = context.lastChar();
      const atGap = last === '' || /\s/.test(last);
      const next = atGap && prev ? predictNext(prev, 3, contextWords) : [];
      const cased = (w: string) => (sentenceStart ? w.charAt(0).toUpperCase() + w.slice(1) : w);
      suggestionBar.current?.show(next.map(text => ({ text: cased(text), literal: false })));
      return;
    }
    const show = (r: { unknown: boolean; words: string[] }) => {
      const items: SuggestionItem[] = r.words.map(text => ({ text, literal: false }));
      if (r.unknown) items.unshift({ text: word, literal: true });
      suggestionBar.current?.show(items.slice(0, 3));
    };
    // Barra na hora (erros simples); a busca ampla (erros de várias letras)
    // completa logo depois, sem segurar a próxima tecla
    show(suggest(word, 3, prev, true, contextWords));
    if (fullTimer.current) clearTimeout(fullTimer.current);
    if (needsFullSuggest(word, prev, contextWords)) {
      fullTimer.current = setTimeout(() => {
        fullTimer.current = null;
        if (context.currentWord() === word) show(suggest(word, 3, prev, false, contextWords));
      }, 0);
    }
  };

  /**
   * Correção automática antes do espaço ou da pontuação (`trail`). Não mexe em
   * palavras que a pessoa já desfez nem fora do modo de letras.
   */
  const applyAutocorrect = (trail: string): boolean => {
    if (!context.allowsSuggestions() || modeRef.current !== 'alpha') return false;
    const word = context.currentWord();
    if (!word || keepAsTyped.current.has(word.toLowerCase())) return false;
    if (word[0] !== word[0].toLowerCase() && !context.wordStartsSentence()) return false;
    const contextWords = context.previousWords(5);
    const { autocorrect } = suggest(word, 3, context.previousWord(), false, contextWords);
    if (!autocorrect || autocorrect === word) return false;
    out.current.replaceTextBeforeCursor(word.length, autocorrect + trail);
    context.replace(word.length, autocorrect + trail);
    lastFix.current = { original: word, fixed: autocorrect, trail };
    return true;
  };

  /** ⌫ logo depois de uma correção automática: volta ao que foi digitado. */
  const undoAutocorrect = (): boolean => {
    const fix = lastFix.current;
    lastFix.current = null;
    if (!fix || !context.endsWith(fix.fixed + fix.trail)) return false;
    const count = fix.fixed.length + fix.trail.length;
    out.current.replaceTextBeforeCursor(count, fix.original);
    context.replace(count, fix.original);
    keepAsTyped.current.add(fix.original.toLowerCase());
    return true;
  };

  // Dicionário montado logo depois de abrir (fora do caminho do 1º toque)
  useEffect(() => {
    const t = setTimeout(() => {
      buildLexicon();
      refresh.current();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, setMode]);

  // Contexto do campo: ao abrir, ao trocar de campo e quando o cursor muda por fora
  useEffect(() => {
    context.reset();
    // Campo do próprio teclado: o texto só muda por aqui, não há o que vigiar
    if (internal) return () => context.dispose();
    const offShow = KeyboardBridge.onKeyboardShow(e => {
      context.reset();
      setEmojiOpen(false);
      // Se o campo for numérico no Android (telefone/números), abre em numeric; senão, SEMPRE letras (alpha)
      const isNumericField = !!(e?.inputType && ((e.inputType & 0xf) === 0x2 || (e.inputType & 0xf) === 0x3));
      setMode(isNumericField ? 'numeric' : (initialMode ?? 'alpha'));
    });
    const offHide = KeyboardBridge.onKeyboardHide(() => {
      setEmojiOpen(false);
      setMode(initialMode ?? 'alpha');
    });
    const offSel = KeyboardBridge.onSelectionChange(e => context.onSelectionChange(e));
    return () => {
      offShow();
      offHide();
      offSel();
      context.dispose();
    };
  }, [context, initialMode, internal, setMode]);

  // ── Ações ────────────────────────────────────────────────────────────

  const typeText = useCallback(
    (v: string) => {
      const lastIsAutoSpace = autoSpace.current && context.lastChar() === ' ';
      autoSpace.current = false;
      lastFix.current = null;
      if (lastIsAutoSpace && SNAP_PUNCTUATION.includes(v)) {
        // "palavra ." → "palavra. "
        out.current.replaceTextBeforeCursor(1, `${v} `);
        context.replace(1, `${v} `);
      } else if (!(SNAP_PUNCTUATION.includes(v) && applyAutocorrect(v))) {
        out.current.insertText(v);
        context.insert(v);
      }
      if (shiftRef.current === 'once') setShift('off');
      // Nos números e símbolos o teclado continua neles; só o apóstrofo (e o
      // espaço, em typeSpace) voltam para as letras
      if (modeRef.current !== 'alpha' && v === "'") setMode('alpha');
      refresh.current();
    },
    // applyAutocorrect só lê refs e o contexto
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, setMode, setShift],
  );

  const typeSpace = useCallback(() => {
    const now = Date.now();
    const before = context.lastChar();
    autoSpace.current = false;
    if (now - lastSpaceAt.current < DOUBLE_SPACE_MS && before === ' ') {
      // Dois espaços seguidos: ponto final (como no iPhone)
      lastFix.current = null;
      out.current.replaceTextBeforeCursor(1, '. ');
      context.replace(1, '. ');
      lastSpaceAt.current = 0;
    } else {
      lastFix.current = null;
      // Palavra errada + espaço: corrige sozinho
      if (!applyAutocorrect(' ')) {
        out.current.insertText(' ');
        context.insert(' ');
      }
      lastSpaceAt.current = now;
    }
    if (modeRef.current !== 'alpha') setMode('alpha');
    refresh.current();
    // applyAutocorrect só lê refs e o contexto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, setMode]);

  const onShift = useCallback(() => {
    const now = Date.now();
    const s = shiftRef.current;
    if (s === 'lock') {
      setShift('off');
      lastShiftTap.current = 0;
    } else if (now - lastShiftTap.current < DOUBLE_TAP_MS) {
      // Dois toques rápidos: trava (vale também no início de frase, com a maiúscula automática)
      setShift('lock');
      lastShiftTap.current = 0;
    } else {
      setShift(s === 'off' ? 'once' : 'off');
      lastShiftTap.current = now;
    }
  }, [setShift]);

  /** Um ⌫ (desfaz a correção automática logo depois dela). */
  const deleteOnceRef = useRef(() => Promise.resolve(false));
  deleteOnceRef.current = () => {
    autoSpace.current = false;
    if (undoAutocorrect()) {
      refresh.current();
      return Promise.resolve(true);
    }
    context.deleteOne();
    refresh.current();
    return out.current.deleteBackward();
  };
  const deleteOnce = useCallback(() => {
    deleteOnceRef.current();
  }, []);

  // Repetição do ⌫ (ver deleteRepeater: nunca deixa timer órfão e para sozinha
  // com o campo vazio). Antes, um timer perdido apagava o texto para sempre.
  const [deleteRepeater] = useState(() =>
    createDeleteRepeater(() => deleteOnceRef.current(), {
      delayMs: REPEAT_DELAY_MS,
      intervalMs: REPEAT_INTERVAL_MS,
      maxMs: MAX_REPEAT_MS,
    }),
  );
  const stopDelete = deleteRepeater.stop;

  // Para a repetição ao sair da tela de letras e quando o teclado é escondido
  // (nesse caso o "soltar o dedo" nunca chega ao ⌫).
  useEffect(() => stopDelete, [stopDelete]);
  useEffect(() => KeyboardBridge.onKeyboardHide(stopDelete), [stopDelete]);

  const run = useCallback(
    (key: KeyDef) => {
      const a = key.action;
      switch (a.t) {
        case 'char':
          // Letra: maiúscula ou não pelo shift DE AGORA. A tecla guarda a forma
          // do último desenho, e quem digita rápido toca antes de redesenhar
          // (saíam duas maiúsculas no começo da frase)
          typeText(key.letter ? (shiftRef.current !== 'off' ? key.letter.toUpperCase() : key.letter) : a.v);
          break;
        case 'space':
          typeSpace();
          break;
        case 'enter':
          autoSpace.current = false;
          lastFix.current = null;
          out.current.sendEnter();
          // No formulário, ↵ passa para o próximo campo (o texto não ganha quebra)
          if (!internal) context.insert('\n');
          // Enter: se estava em símbolos, volta para letras
          if (modeRef.current === 'symbols') setMode('alpha');
          refresh.current();
          break;
        case 'mode':
          setMode(a.to);
          break;
        case 'emoji':
          setEmojiOpen(true);
          break;
        default:
          break;
      }
    },
    [context, internal, setMode, typeSpace, typeText],
  );

  // Versão web: o teclado do computador digita como as teclas do KEYCON (mesma
  // correção, sugestões, ⌫ e ↵). Num campo do próprio teclado (tradução,
  // formulários) as teclas vão para ele mesmo com o cursor na conversa; na
  // conversa, o campo da página aceita a digitação direta. Só com este teclado à
  // vista: os campos da tela do app (TextInput) continuam com o teclado do PC.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: { addEventListener: Function; removeEventListener: Function } }).document;
    if (!doc) return;
    const onKey = (e: {
      key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; isComposing?: boolean;
      target: unknown; preventDefault(): void; stopPropagation(): void;
    }) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const area = areaRef.current as unknown as { offsetParent?: unknown } | null;
      if (!area || !area.offsetParent) return; // teclado escondido (ex.: tela do App)
      const el = e.target as { tagName?: string; isContentEditable?: boolean } | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || !!el.isContentEditable);
      if (!internal && inField) return; // conversa: o próprio campo da página recebe
      const key = e.key;
      if (key === 'Backspace') deleteOnceRef.current();
      else if (key === 'Enter') runRef.current({ id: 'enter', label: '', kind: 'enter', flex: 1, action: { t: 'enter' } } as KeyDef);
      else if (key === ' ') typeSpace();
      else if (key.length === 1) {
        // Letra sem Shift no PC: segue a maiúscula automática do teclado (início de frase, caps)
        const auto = /\p{L}/u.test(key) && key === key.toLowerCase() && shiftRef.current !== 'off';
        typeText(auto ? key.toUpperCase() : key);
      }
      else return;
      e.preventDefault();
      e.stopPropagation();
      handled = key;
    };
    // Botão com foco (ex.: o do Traduzir) "clica" ao soltar o espaço: segura esse clique
    let handled = '';
    const onKeyUp = (e: { key: string; preventDefault(): void; stopPropagation(): void }) => {
      if (handled && e.key === handled) {
        e.preventDefault();
        e.stopPropagation();
      }
      handled = '';
    };
    // Fase de captura: a tecla chega aqui antes do botão com foco
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('keyup', onKeyUp, true);
    return () => {
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('keyup', onKeyUp, true);
    };
  }, [internal, typeSpace, typeText]);

  /** Painel de emojis aberto no lugar das teclas. */
  const [emojiOpen, setEmojiOpen] = useState(false);
  const insertEmoji = useCallback(
    (emoji: string) => {
      autoSpace.current = false;
      lastFix.current = null;
      out.current.insertText(emoji);
      context.insert(emoji);
      refresh.current();
    },
    [context],
  );

  const pickSuggestion = useCallback(
    (item: SuggestionItem) => {
      const word = context.currentWord();
      lastFix.current = null;
      if (!word && !item.literal) {
        // Próxima palavra prevista
        out.current.insertText(`${item.text} `);
        context.insert(`${item.text} `);
      } else if (item.literal || !word) {
        // Manter o que foi digitado (e não corrigir mais essa palavra)
        if (word) keepAsTyped.current.add(word.toLowerCase());
        out.current.insertText(' ');
        context.insert(' ');
      } else {
        out.current.replaceTextBeforeCursor(word.length, `${item.text} `);
        context.replace(word.length, `${item.text} `);
      }
      autoSpace.current = true;
      lastSpaceAt.current = 0;
      if (shiftRef.current === 'once') setShift('off');
      refresh.current();
    },
    [context, setShift],
  );

  // ── Toques ───────────────────────────────────────────────────────────

  const areaRef = useRef<View>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const rowBoxes = useRef<Box[]>([]);
  const areaWidth = useRef(0);
  /** Layout ÷ tela: 1 no celular; menor que 1 quando a página reduz o teclado (zoom do simulador web). */
  const scale = useRef(1);
  const touches = useRef(new Map<string, ActiveTouch>());

  const measureOrigin = useCallback((e?: LayoutChangeEvent) => {
    if (e) areaWidth.current = e.nativeEvent.layout.width;
    if (Platform.OS === 'web') {
      // Na web a página pode reduzir o teclado (zoom do simulador): mede na tela,
      // onde chegam os toques, e converte para o layout pela escala
      areaRef.current?.measureInWindow((x, y, w) => {
        // measureInWindow é relativo à janela; os toques (pageX/pageY), à página
        const win = (globalThis as { scrollX?: number; scrollY?: number });
        const sx = win.scrollX ?? 0;
        const sy = win.scrollY ?? 0;
        origin.current = { x: x + sx, y: y + sy };
        if (w > 0 && areaWidth.current > 0) scale.current = areaWidth.current / w;
      });
      return;
    }
    areaRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      if (typeof pageX === 'number' && typeof pageY === 'number') origin.current = { x: pageX, y: pageY };
    });
  }, []);

  // O teclado pode mudar de lugar sem mudar de tamanho (ex.: abriu junto com a
  // tela grande): mede de novo logo depois de aparecer e ao fim de cada toque
  useEffect(() => {
    const timers = [150, 400, 900].map(ms => setTimeout(() => measureOrigin(), ms));
    return () => timers.forEach(clearTimeout);
  }, [measureOrigin]);

  /** Retângulo de cada tecla, calculado pelas linhas (as teclas dividem a linha pelo flex). */
  const keyRects = useCallback((): KeyRect<KeyDef>[] => {
    const out: KeyRect<KeyDef>[] = [];
    rowsRef.current.forEach((row, i) => {
      const box = rowBoxes.current[i];
      if (!box) return;
      // Mesma conta do flex da fileira, com os respiros das pontas
      const inset = rowInset(row);
      const totalFlex = row.reduce((sum, k) => sum + k.flex, 0) + inset * 2;
      const gaps = row.length - 1 + (inset ? 2 : 0);
      const unit = (box.w - KEY_GAP * gaps) / totalFlex;
      let x = box.x + (inset ? inset * unit + KEY_GAP : 0);
      for (const key of row) {
        const w = unit * key.flex;
        out.push({ x, y: box.y, w, h: box.h, key });
        x += w + KEY_GAP;
      }
    });
    return out;
  }, []);

  const pointOf = (t: NativeTouchEvent) =>
    origin.current
      ? { x: (t.pageX - origin.current.x) * scale.current, y: (t.pageY - origin.current.y) * scale.current }
      : { x: t.locationX, y: t.locationY };

  /** Digita a opção de acento sob o dedo e fecha as opções. */
  const commitAccent = useCallback(
    (active: ActiveTouch) => {
      const session = active.accent;
      if (!session) return;
      active.accent = undefined;
      accentPopup.current?.hide();
      typeText(session.options[session.index]);
    },
    [typeText],
  );

  /** Confirma a tecla de um toque que ainda não agiu (soltou o dedo ou outro dedo encostou). */
  const finish = useCallback(
    (active: ActiveTouch) => {
      if (active.timer) clearTimeout(active.timer);
      active.timer = null;
      if (active.accent) {
        commitAccent(active);
        return;
      }
      if (active.done) return;
      active.done = true;
      run(active.key);
    },
    [commitAccent, run],
  );

  const onTouchDown = useCallback(
    (t: NativeTouchEvent) => {
      // Digitação rápida: o dedo anterior ainda está na tela → confirma já
      touches.current.forEach(finish);

      const { x, y } = pointOf(t);
      const rects = keyRects();
      const prefix = modeRef.current === 'alpha' ? context.currentWord() : '';
      const hit = resolveLetter(rects, x, y, prefix, k => k.letter ?? null);
      if (!hit) return;
      const key = hit.key;
      const active: ActiveTouch = { key, done: false, timer: null };
      const id = String(t.identifier);
      touches.current.set(id, active);
      feedback.current?.press(id, hit, key);

      if (key.action.t === 'shift') {
        active.done = true;
        onShift();
      } else if (key.action.t === 'delete') {
        active.done = true;
        deleteRepeater.start();
      } else if (key.action.t === 'space') {
        // Segurou o espaço: troca o idioma do corretor (o espaço não é digitado)
        active.timer = setTimeout(() => {
          active.timer = null;
          if (active.done) return;
          active.done = true;
          setTypingLanguage(nextTypingLanguage());
        }, LANGUAGE_HOLD_MS);
      } else if (key.letter && ACCENTS[key.letter] && modeRef.current === 'alpha') {
        const letter = key.letter;
        active.timer = setTimeout(() => {
          active.timer = null;
          if (active.done) return;
          // Segurou: abre os acentos acima da tecla. A própria letra fica sob o
          // dedo; arrastar escolhe, soltar digita a escolhida e fecha.
          active.done = true;
          feedback.current?.release(id);
          const upper = shiftRef.current !== 'off';
          const options = [letter, ...ACCENTS[letter]].map(c => (upper ? c.toUpperCase() : c));
          const optW = Math.max(hit.w, 30);
          const total = optW * options.length;
          let x0 = hit.x;
          if (areaWidth.current && x0 + total > areaWidth.current - 2) x0 = Math.max(2, areaWidth.current - 2 - total);
          active.accent = { options, index: 0, x0, optW };
          accentPopup.current?.show({ x: x0, y: hit.y - hit.h - 10, w: optW, h: hit.h + 4, options, index: 0 });
        }, LONG_PRESS_MS);
      }
    },
    // pointOf só lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, deleteRepeater, finish, keyRects, onShift, setShift],
  );

  /** Dedo arrastando: com os acentos abertos, escolhe a opção sob ele. */
  const onTouchMove = useCallback((t: NativeTouchEvent) => {
    const active = touches.current.get(String(t.identifier));
    const session = active?.accent;
    if (!session) return;
    const { x } = pointOf(t);
    const index = Math.max(0, Math.min(session.options.length - 1, Math.floor((x - session.x0) / session.optW)));
    if (index !== session.index) {
      session.index = index;
      accentPopup.current?.select(index);
    }
    // pointOf só lê refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchUp = useCallback(
    (id: string) => {
      const active = touches.current.get(id);
      feedback.current?.release(id);
      if (!active) return;
      touches.current.delete(id);
      if (active.key.action.t === 'delete') stopDelete();
      finish(active);
      if (touches.current.size === 0) measureOrigin();
    },
    [finish, measureOrigin, stopDelete],
  );

  const cancelAll = useCallback(() => {
    touches.current.forEach(a => a.timer && clearTimeout(a.timer));
    touches.current.clear();
    feedback.current?.clear();
    accentPopup.current?.hide();
    stopDelete();
  }, [stopDelete]);

  const responder = useMemo(
    () => ({
      onStartShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      // Disparam para CADA dedo (o primeiro e os seguintes)
      onResponderStart: (e: GestureResponderEvent) => {
        for (const t of pointsOf(e)) onTouchDown(t);
      },
      onResponderMove: (e: GestureResponderEvent) => {
        for (const t of pointsOf(e)) onTouchMove(t);
      },
      onResponderEnd: (e: GestureResponderEvent) => {
        for (const t of pointsOf(e)) onTouchUp(String(t.identifier));
      },
      onResponderTerminate: cancelAll,
    }),
    [cancelAll, onTouchDown, onTouchMove, onTouchUp],
  );

  const onRowLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    rowBoxes.current[i] = { x, y, w: width, h: height };
  };

  if (emojiOpen) {
    return (
      <View style={styles.container} testID="typing-keyboard">
        <EmojiPanel
          onPick={insertEmoji}
          onDelete={deleteOnce}
          onDeleteHoldStart={deleteRepeater.start}
          onDeleteHoldEnd={stopDelete}
          onClose={() => setEmojiOpen(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="typing-keyboard">
      <SuggestionBar ref={suggestionBar} onPick={pickSuggestion} />

      <View ref={areaRef} style={styles.keysArea} onLayout={measureOrigin} {...responder}>
        {/* As teclas só desenham: quem recebe o toque é a área inteira */}
        <View style={styles.rows} pointerEvents="none">
          {rows.map((row, i) => (
            <View key={i} style={styles.row} onLayout={onRowLayout(i)}>
              {rowInset(row) > 0 && <View style={{ flex: rowInset(row) }} />}
              {row.map(k => (
                <KeyView
                  key={k.id}
                  label={k.label}
                  icon={k.icon}
                  kind={k.kind}
                  flex={k.flex}
                  active={k.action.t === 'shift' && shift !== 'off'}
                />
              ))}
              {rowInset(row) > 0 && <View style={{ flex: rowInset(row) }} />}
            </View>
          ))}
        </View>
        <PressFeedback ref={feedback} />
        <AccentPopup ref={accentPopup} />
      </View>
    </View>
  );
}

// ── Teclas (só desenho) ─────────────────────────────────────────────────

interface KeyViewProps {
  label: string;
  icon?: IconName;
  kind: KeyKind;
  flex: number;
  active: boolean;
}

const KeyView = memo(({ label, icon, kind, flex, active }: KeyViewProps) => {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View
      // O espaço mostra o idioma; o nome da tecla continua "espaço"
      testID={kind === 'space' ? 'key-espaço' : `key-${label}`}
      accessibilityLabel={kind === 'space' ? `${t('espaço')}, ${label}` : label}
      style={[
        styles.key,
        { flex },
        kind === 'func' && styles.keyFunc,
        kind === 'enter' && styles.keyEnter,
        active && styles.keyPressed,
      ]}>
      {icon ? (
        <Icon name={icon} size={22} color={kind === 'enter' ? colors.onPrimary : colors.text} />
      ) : (
        <Text
          style={[
            styles.label,
            kind === 'func' && styles.labelFunc,
            kind === 'space' && styles.labelSpace,
          ]}>
          {label}
        </Text>
      )}
    </View>
  );
});

// ── Acentos: opções acima da tecla segurada ───────────────────────────

interface AccentPopupHandle {
  show(state: AccentPopupState): void;
  select(index: number): void;
  hide(): void;
}

interface AccentPopupState {
  x: number;
  y: number;
  /** Largura e altura de cada opção. */
  w: number;
  h: number;
  options: string[];
  index: number;
}

/** Fileira de acentos; a opção sob o dedo fica em coral. Só desenho (o toque é da área). */
const AccentPopup = memo(
  forwardRef<AccentPopupHandle>((_props, ref) => {
    const styles = useStyles();
    const [state, setState] = useState<AccentPopupState | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        show: setState,
        select: index => setState(s => (s && s.index !== index ? { ...s, index } : s)),
        hide: () => setState(null),
      }),
      [],
    );

    if (!state) return null;
    return (
      <View
        pointerEvents="none"
        testID="accent-popup"
        style={[styles.accentPopup, { left: state.x - 4, top: state.y - 4, height: state.h + 8 }]}>
        {state.options.map((option, i) => (
          <View
            key={option}
            testID={`accent-${option}`}
            style={[styles.accentOption, { width: state.w, height: state.h }, i === state.index && styles.accentOptionActive]}>
            <Text style={[styles.accentLabel, i === state.index && styles.accentLabelActive]}>{option}</Text>
          </View>
        ))}
      </View>
    );
  }),
);

// ── Destaque da tecla apertada (balão com a letra, como no celular) ─────

interface PressFeedbackHandle {
  press(id: string, box: Box, key: KeyDef): void;
  release(id: string): void;
  clear(): void;
}

interface Pressed {
  id: string;
  box: Box;
  key: KeyDef;
}

const PressFeedback = memo(
  forwardRef<PressFeedbackHandle>((_props, ref) => {
    const colors = useColors();
    const styles = useStyles();
    const [pressed, setPressed] = useState<Pressed[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        press: (id, box, key) => setPressed(list => [...list.filter(p => p.id !== id), { id, box, key }]),
        release: id => setPressed(list => (list.some(p => p.id === id) ? list.filter(p => p.id !== id) : list)),
        clear: () => setPressed([]),
      }),
      [],
    );

    return (
      <View style={styles.feedbackLayer} pointerEvents="none">
        {pressed.map(({ id, box, key }) => {
          const bubble = key.kind === 'char';
          return (
            <React.Fragment key={id}>
              <View
                style={[
                  styles.key,
                  styles.feedbackKey,
                  { left: box.x, top: box.y, width: box.w, height: box.h },
                  key.kind === 'enter' ? styles.keyEnterPressed : styles.keyPressed,
                ]}>
                {key.icon ? (
                  <Icon name={key.icon} size={22} color={key.kind === 'enter' ? colors.onPrimary : colors.text} />
                ) : (
                  <Text style={[styles.label, key.kind === 'space' && styles.labelSpace]}>{key.label}</Text>
                )}
              </View>
              {bubble && (
                <View
                  style={[
                    styles.bubble,
                    { left: box.x - 6, top: box.y - box.h - 6, width: box.w + 12, height: box.h + 4 },
                  ]}>
                  <Text style={styles.bubbleLabel}>{key.label}</Text>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  }),
);

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keysArea: {
    flex: 1,
  },
  rows: {
    flex: 1,
    paddingHorizontal: 3,
    paddingTop: 2,
    paddingBottom: 4,
    gap: ROW_GAP,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  accentPopup: {
    position: 'absolute',
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.key,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  accentOption: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.key,
  },
  accentOptionActive: {
    backgroundColor: colors.primary,
  },
  accentLabel: {
    color: colors.text,
    fontSize: 22,
  },
  accentLabelActive: {
    ...onCoralText,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  key: {
    borderRadius: radius.key,
    backgroundColor: colors.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyFunc: {
    backgroundColor: colors.keySpecial,
  },
  keyEnter: {
    backgroundColor: colors.primary,
  },
  keyEnterPressed: {
    backgroundColor: colors.primaryStrong,
  },
  keyPressed: {
    backgroundColor: colors.keyActive,
  },
  label: {
    color: colors.text,
    fontSize: 20,
  },
  labelFunc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  labelSpace: {
    fontSize: 13,
    color: colors.textMuted,
  },
  feedbackLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  feedbackKey: {
    position: 'absolute',
  },
  bubble: {
    position: 'absolute',
    borderRadius: radius.sm,
    backgroundColor: colors.key,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  bubbleLabel: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '500',
  },
}));
