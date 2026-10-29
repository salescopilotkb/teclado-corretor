/**
 * Tradução simultânea no teclado (botão "Traduzir" do menu, ao lado do
 * ícone do teclado). A pessoa escreve no seu idioma numa faixa leve entre o
 * menu e as teclas (o teclado de letras do KEYCON escreve nela) e a tradução
 * vai sendo escrita, já traduzida, no campo de mensagem da conversa — é só
 * enviar. O teclado cresce só a altura da faixa: a conversa fica à vista.
 *
 * Tradução: Google ML Kit no próprio aparelho (src/native/Translator).
 *
 * Segurança do campo da conversa: o painel só troca o texto que ele mesmo
 * escreveu por último (confere o fim do campo antes de trocar). Quando a
 * mensagem é enviada (o campo esvazia), a caixa limpa para a próxima.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getSellingLanguage, getTypingLanguage, setTypingLanguage, t } from '../../i18n';
import { useKeyboardBack } from '../../navigation/back';
import type { Lang } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { InputContext } from '../../native/KeyboardBridge';
import { isTranslatorReady, translate, TRANSLATE_LANGUAGES } from '../../native/Translator';
import type { TranslateLang } from '../../native/Translator';
import { storage } from '../../storage/storage';
import { glassBorder, makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';
import { KeyboardFormKeys } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';
import type { TextSink } from './TypingKeyboard';
import { lastGrapheme } from '../typing/typingContext';

const PAIR_KEY = 'keyboard.translatePair';
/** Espera de digitação antes de traduzir (não traduz a cada letra). */
const DEBOUNCE_MS = 350;
/** O campo da conversa devolve no máximo ~200 caracteres antes do cursor. */
const CHECK_TAIL = 150;

/** Altura da faixa (idiomas, texto e prévia): o teclado cresce só isso (heightMode 'translate'). */
const STRIP_HEIGHT = 104;
/** Caracteres do fim do texto que cabem numa linha da faixa. */
const FIELD_TAIL = 42;
const PREVIEW_TAIL = 52;
/** De quanto em quanto tempo confere se a mensagem já foi enviada. */
const SENT_CHECK_MS = 700;

const FIELD: FormFieldSpec = { key: 'text', label: 'Sua mensagem', placeholder: 'Escreva no seu idioma', kind: 'multiline' };

const isKeyboardLang = (l: string): l is Lang => l === 'pt' || l === 'en' || l === 'es';

/** Último par usado; na 1ª vez: do idioma de digitação para o de venda (ou inglês). */
function initialPair(): { source: TranslateLang; target: TranslateLang } {
  try {
    const saved = JSON.parse(storage.getString(PAIR_KEY) ?? 'null');
    if (saved?.source && saved?.target && saved.source !== saved.target) return saved;
  } catch {
    // par salvo inválido: usa o padrão
  }
  const source = getTypingLanguage() as TranslateLang;
  const selling = getSellingLanguage() as TranslateLang;
  return { source, target: selling !== source ? selling : source === 'en' ? 'es' : 'en' };
}

const labelOf = (id: TranslateLang) => TRANSLATE_LANGUAGES.find(l => l.id === id)?.label ?? id;

interface CharSpan {
  char: string;
  start: number;
  end: number;
}

function getCharSpans(str: string): CharSpan[] {
  const spans: CharSpan[] = [];
  let idx = 0;
  for (const char of Array.from(str)) {
    spans.push({
      char,
      start: idx,
      end: idx + char.length,
    });
    idx += char.length;
  }
  return spans;
}

export function TranslatePanel({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  // O "voltar" do celular fecha a tradução
  useKeyboardBack(onClose);
  const [pair, setPair] = useState(initialPair);
  const [picking, setPicking] = useState<'source' | 'target' | null>(null);
  const [translated, setTranslated] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'downloading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [caretPos, setCaretPos] = useState(0);
  const [caretVisible, setCaretVisible] = useState(true);

  /** Onde as teclas do KEYCON digitam: 'translator' (visor do tradutor) ou 'device' (campo da conversa do WhatsApp). */
  const [focusTarget, setFocusTarget] = useState<'translator' | 'device'>('translator');
  const focusTargetRef = useRef(focusTarget);
  focusTargetRef.current = focusTarget;
  const writingChat = useRef(false);

  const textRef = useRef(text);
  textRef.current = text;
  const caretRef = useRef(caretPos);
  caretRef.current = caretPos;

  const scrollRef = useRef<ScrollView>(null);
  const spanLayouts = useRef<Map<number, number>>(new Map());

  // Cursor pisca a cada 530ms (só quando focado no tradutor)
  useEffect(() => {
    const timer = setInterval(() => setCaretVisible(v => !v), 530);
    return () => clearInterval(timer);
  }, []);

  // Quando o usuário clica no campo de texto do WhatsApp/dispositivo, alterna para digitar nele
  useEffect(() => {
    const offFocus = KeyboardBridge.onFocusDeviceField?.(() => {
      setFocusTarget('device');
    });
    return () => {
      offFocus?.();
    };
  }, []);

  const setCaret = useCallback((pos: number) => {
    setFocusTarget('translator');
    const clamped = Math.max(0, Math.min(pos, textRef.current.length));
    caretRef.current = clamped;
    setCaretPos(clamped);
    setCaretVisible(true);
    const x = spanLayouts.current.get(clamped);
    if (typeof x === 'number') {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - 60), animated: true });
    }
  }, []);

  /** O que o painel escreveu por último no campo da conversa. */
  const inserted = useRef('');
  /** Muda a cada mensagem nova: o teclado de letras recomeça (maiúscula no início). */
  const [round, setRound] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    storage.set(PAIR_KEY, JSON.stringify(pair));
  }, [pair]);

  // O corretor do teclado segue o idioma de origem enquanto o painel está no visor de tradução
  useEffect(() => {
    if (focusTarget !== 'translator') return;
    const before = getTypingLanguage();
    if (isKeyboardLang(pair.source)) setTypingLanguage(pair.source);
    return () => setTypingLanguage(before);
  }, [pair.source, focusTarget]);

  /** Uma escrita no campo da conversa por vez (duas ao mesmo tempo embaralhariam o texto). */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const writeChat = async (next: string) => {
    if (focusTargetRef.current === 'device') return;
    const prev = inserted.current;
    if (next === prev) return;
    writingChat.current = true;
    try {
      const { before } = await KeyboardBridge.getInputContext().catch(() => ({ before: '' }));
      if (prev && !before.endsWith(prev.slice(-CHECK_TAIL))) {
        // A pessoa mexeu no campo (ou enviou): não apaga nada dela, só acrescenta
        inserted.current = '';
        if (next) await KeyboardBridge.insertText(next);
      } else if (prev) {
        await KeyboardBridge.replaceTextBeforeCursor(prev.length, next);
      } else if (next) {
        await KeyboardBridge.insertText(next);
      }
      inserted.current = next;
    } finally {
      setTimeout(() => {
        writingChat.current = false;
      }, 150);
    }
  };

  /** Escreve a tradução no campo da conversa, trocando só o que o painel escreveu. */
  const syncChat = useCallback((next: string) => {
    queue.current = queue.current.then(() => writeChat(next)).catch(() => {});
    return queue.current;
  }, []);

  const moveCaretLeft = useCallback(() => {
    const spans = getCharSpans(textRef.current);
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].start < caretRef.current) {
        setCaret(spans[i].start);
        return;
      }
    }
    setCaret(0);
  }, [setCaret]);

  const moveCaretRight = useCallback(() => {
    const spans = getCharSpans(textRef.current);
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].end > caretRef.current) {
        setCaret(spans[i].end);
        return;
      }
    }
    setCaret(textRef.current.length);
  }, [setCaret]);

  const clearText = useCallback(() => {
    textRef.current = '';
    caretRef.current = 0;
    setText('');
    setCaretPos(0);
    setTranslated('');
    setStatus('idle');
    syncChat('');
  }, [syncChat]);

  const sink = useMemo<TextSink>(
    () => ({
      insertText: async chunk => {
        const curr = textRef.current;
        const pos = Math.max(0, Math.min(caretRef.current, curr.length));
        const next = curr.slice(0, pos) + chunk + curr.slice(pos);
        const nextPos = pos + chunk.length;
        textRef.current = next;
        caretRef.current = nextPos;
        setText(next);
        setCaretPos(nextPos);
        setCaretVisible(true);
        return true;
      },
      deleteBackward: async () => {
        const curr = textRef.current;
        const pos = Math.max(0, Math.min(caretRef.current, curr.length));
        if (pos <= 0) return false;
        const before = curr.slice(0, pos);
        const g = lastGrapheme(before);
        const gLen = g.length || 1;
        const next = curr.slice(0, pos - gLen) + curr.slice(pos);
        const nextPos = Math.max(0, pos - gLen);
        textRef.current = next;
        caretRef.current = nextPos;
        setText(next);
        setCaretPos(nextPos);
        setCaretVisible(true);
        return true;
      },
      replaceTextBeforeCursor: async (count, chunk) => {
        const curr = textRef.current;
        const pos = Math.max(0, Math.min(caretRef.current, curr.length));
        const cutStart = Math.max(0, pos - count);
        const next = curr.slice(0, cutStart) + chunk + curr.slice(pos);
        const nextPos = cutStart + chunk.length;
        textRef.current = next;
        caretRef.current = nextPos;
        setText(next);
        setCaretPos(nextPos);
        setCaretVisible(true);
        return true;
      },
      sendEnter: async () => {
        const curr = textRef.current;
        const pos = Math.max(0, Math.min(caretRef.current, curr.length));
        const next = curr.slice(0, pos) + '\n' + curr.slice(pos);
        const nextPos = pos + 1;
        textRef.current = next;
        caretRef.current = nextPos;
        setText(next);
        setCaretPos(nextPos);
        setCaretVisible(true);
        return true;
      },
      getInputContext: async (): Promise<InputContext> => {
        const curr = textRef.current;
        const pos = Math.max(0, Math.min(caretRef.current, curr.length));
        return {
          before: curr.slice(0, pos),
          inputType: 0x1 | 0x4000 | 0x20000,
        };
      },
    }),
    [],
  );

  // Traduz enquanto a pessoa escreve (com uma pequena espera)
  useEffect(() => {
    const id = ++seq.current;
    if (!text.trim()) {
      setTranslated('');
      setStatus('idle');
      syncChat('');
      return;
    }
    const timer = setTimeout(async () => {
      const ready = await isTranslatorReady(pair.source, pair.target);
      if (id !== seq.current) return;
      setStatus(ready ? 'working' : 'downloading');
      try {
        const result = await translate(text, pair.source, pair.target);
        if (id !== seq.current) return;
        setTranslated(result);
        setStatus('idle');
        setError(null);
        await syncChat(result);
      } catch (e) {
        if (id !== seq.current) return;
        setStatus('error');
        const msg = e instanceof Error ? e.message : '';
        const isTechnical = /generic failures|failed to|network|fetch|denied|unknown/i.test(msg);
        setError(!isTechnical && msg ? t(msg) : t('Não foi possível traduzir.'));
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, pair, syncChat]);

  // Mensagem enviada (o campo da conversa esvaziou): limpa a caixa para a próxima.
  // Confere quando o cursor da conversa muda, quando o campo reinicia (alguns apps
  // trocam o campo ao enviar) e, por garantia, a cada SENT_CHECK_MS enquanto há texto.
  const checkSent = useCallback(async () => {
    if (!inserted.current) return;
    const { before } = await KeyboardBridge.getInputContext().catch(() => ({ before: 'x' }));
    if (before !== '' || !inserted.current) return;
    inserted.current = '';
    seq.current++; // tradução atrasada da mensagem enviada não volta para o campo
    textRef.current = '';
    caretRef.current = 0;
    setText('');
    setCaretPos(0);
    setTranslated('');
    setStatus('idle');
    setRound(r => r + 1);
  }, []);

  useEffect(() => {
    const offSel = KeyboardBridge.onSelectionChange(() => {
      checkSent();
      if (!writingChat.current) {
        setFocusTarget('device');
      }
    });
    const offShow = KeyboardBridge.onKeyboardShow(() => {
      checkSent();
    });
    const timer = setInterval(checkSent, SENT_CHECK_MS);
    return () => {
      offSel();
      offShow();
      clearInterval(timer);
    };
  }, [checkSent]);

  const swap = () => {
    setPicking(null);
    setPair(p => ({ source: p.target, target: p.source }));
  };

  const choose = (side: 'source' | 'target', id: TranslateLang) => {
    setPicking(null);
    setPair(p => {
      const other = side === 'source' ? p.target : p.source;
      // Escolheu o mesmo do outro lado: inverte
      if (id === other) return { source: p.target, target: p.source };
      return side === 'source' ? { source: id, target: p.target } : { source: p.source, target: id };
    });
  };

  const statusText =
    status === 'downloading'
      ? t('Baixando o tradutor deste idioma (só na primeira vez, cerca de 30 MB)...')
      : status === 'error'
        ? error
        : null;

  const spans = useMemo(() => getCharSpans(text), [text]);
  const canMoveLeft = caretPos > 0;
  const canMoveRight = caretPos < text.length;

  return (
    <View style={styles.root} testID="translate-panel">
      {/* Faixa leve entre o menu e as teclas: a conversa e o campo dela continuam à vista */}
      <View style={styles.strip}>
        <View style={styles.head}>
          <LangChip
            testID="translate-source"
            label={t('De')}
            name={labelOf(pair.source)}
            open={picking === 'source'}
            onPress={() => setPicking(p => (p === 'source' ? null : 'source'))}
          />
          <Pressable testID="translate-swap" accessibilityRole="button" accessibilityLabel={t('Inverter idiomas')} hitSlop={8} style={styles.iconBtn} onPress={swap}>
            <Icon name="traduzir" size={16} color={colors.primary} />
          </Pressable>
          <LangChip
            testID="translate-target"
            label={t('Para')}
            name={labelOf(pair.target)}
            open={picking === 'target'}
            onPress={() => setPicking(p => (p === 'target' ? null : 'target'))}
          />
          <View style={styles.flex} />

          {/* Alternador de foco: tradutor vs conversa do dispositivo */}
          <Pressable
            testID="translate-focus-toggle"
            accessibilityRole="button"
            accessibilityLabel={focusTarget === 'translator' ? t('Digitar na conversa') : t('Voltar à tradução')}
            hitSlop={6}
            style={[styles.focusPill, focusTarget === 'device' && styles.focusPillActive]}
            onPress={() => setFocusTarget(f => (f === 'translator' ? 'device' : 'translator'))}>
            <Icon
              name={focusTarget === 'translator' ? 'respostas' : 'traduzir'}
              size={12}
              color={focusTarget === 'device' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.focusPillText, focusTarget === 'device' && styles.focusPillTextActive]}>
              {focusTarget === 'device' ? t('Na conversa') : t('Traduzir')}
            </Text>
          </Pressable>

          <Pressable testID="translate-close" accessibilityRole="button" accessibilityLabel={t('Fechar tradução')} hitSlop={8} style={styles.iconBtn} onPress={onClose}>
            <Icon name="fechar" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {picking ? (
          <ScrollView horizontal style={styles.body} contentContainerStyle={styles.choices} keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
            {TRANSLATE_LANGUAGES.map(l => {
              const selected = pair[picking] === l.id;
              return (
                <Pressable
                  key={l.id}
                  testID={`translate-lang-${l.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.choice, selected && styles.choiceSelected]}
                  onPress={() => choose(picking, l.id)}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.body}>
            <Pressable
              style={[styles.field, focusTarget === 'device' && styles.fieldDevice]}
              onPress={() => {
                if (focusTarget === 'device') setFocusTarget('translator');
              }}
              testID="kbfield-text"
              accessible
              accessibilityLabel={t(FIELD.label)}>
              {focusTarget === 'device' ? (
                <View style={styles.deviceModeBadge}>
                  <Icon name="respostas" size={13} color={colors.primary} />
                  <Text style={styles.deviceModeText} numberOfLines={1}>
                    {t('Digitando na conversa')}
                  </Text>
                  <Text style={styles.deviceModeHint} numberOfLines={1}>
                    {t('• Toque aqui para traduzir')}
                  </Text>
                </View>
              ) : text ? (
                <>
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.fieldScroll}
                    contentContainerStyle={styles.fieldScrollContent}
                    keyboardShouldPersistTaps="always">
                    <Pressable
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 2 }}
                      onPress={() => setCaret(0)}
                      style={styles.touchEdge}
                      accessibilityRole="button"
                      accessibilityLabel={t('Início')}>
                      {caretPos === 0 && <View style={[styles.caret, styles.caretStart, !caretVisible && styles.caretHidden]} />}
                    </Pressable>

                    <View style={styles.charsWrap}>
                      {spans.map((s, idx) => (
                        <React.Fragment key={`${s.start}-${idx}`}>
                          <Pressable
                            hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
                            onLayout={e => {
                              spanLayouts.current.set(s.end, e.nativeEvent.layout.x + e.nativeEvent.layout.width);
                              if (s.start === 0) spanLayouts.current.set(0, e.nativeEvent.layout.x);
                            }}
                            onPress={e => {
                              const x = e.nativeEvent?.locationX ?? 10;
                              if (x < 6) {
                                setCaret(s.start);
                              } else {
                                setCaret(s.end);
                              }
                            }}
                            style={styles.charTouch}>
                            <Text style={styles.charText}>{s.char === '\n' ? '↵' : s.char}</Text>
                          </Pressable>
                          {caretPos === s.end && <View style={[styles.caret, !caretVisible && styles.caretHidden]} />}
                        </React.Fragment>
                      ))}
                    </View>

                    <Pressable
                      onPress={() => setCaret(text.length)}
                      style={styles.touchFill}
                      accessibilityRole="button"
                      accessibilityLabel={t('Fim')}
                    />
                  </ScrollView>

                  <View style={styles.cursorControls}>
                    <Pressable
                      hitSlop={6}
                      disabled={!canMoveLeft}
                      style={[styles.cursorBtn, !canMoveLeft && styles.cursorBtnDisabled]}
                      onPress={moveCaretLeft}
                      accessibilityRole="button"
                      accessibilityLabel={t('Voltar caractere')}>
                      <Text style={styles.cursorBtnText}>‹</Text>
                    </Pressable>
                    <Pressable
                      hitSlop={6}
                      disabled={!canMoveRight}
                      style={[styles.cursorBtn, !canMoveRight && styles.cursorBtnDisabled]}
                      onPress={moveCaretRight}
                      accessibilityRole="button"
                      accessibilityLabel={t('Avançar caractere')}>
                      <Text style={styles.cursorBtnText}>›</Text>
                    </Pressable>
                    <Pressable
                      hitSlop={6}
                      style={styles.clearBtn}
                      onPress={clearText}
                      accessibilityRole="button"
                      accessibilityLabel={t('Limpar')}>
                      <Icon name="fechar" size={11} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable style={styles.fieldEmptyTouch} onPress={() => setCaret(0)}>
                  <View style={[styles.caret, styles.caretStart, !caretVisible && styles.caretHidden]} />
                  <Text style={styles.placeholder} numberOfLines={1}>
                    {t(FIELD.placeholder)}
                  </Text>
                </Pressable>
              )}
            </Pressable>
            <Text
              testID="translate-result"
              style={[styles.preview, status === 'error' && styles.previewError]}
              numberOfLines={1}
              accessibilityLiveRegion="polite">
              {focusTarget === 'device'
                ? t('✓ Teclado ativo no campo da conversa (WhatsApp)')
                : statusText ?? (translated ? `→ ${tail(translated, PREVIEW_TAIL)}` : ' ')}
            </Text>
          </View>
        )}
      </View>

      <KeyboardFormKeys
        sink={focusTarget === 'translator' ? sink : undefined}
        activeKey={`${focusTarget}-${round}`}
        spec={focusTarget === 'translator' ? FIELD : undefined}
      />
    </View>
  );
}

/** Mostra o fim do texto (onde a pessoa está escrevendo) quando ele não cabe na linha. */
function tail(text: string, max: number): string {
  return text.length > max ? `…${text.slice(-max)}` : text;
}

function LangChip({ testID, label, name, open, onPress }: { testID: string; label: string; name: string; open: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${name}`}
      accessibilityState={{ expanded: open }}
      hitSlop={4}
      style={[styles.chip, open && styles.chipOpen]}
      onPress={onPress}>
      <Text style={styles.chipText} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.chipArrow}>{open ? '▴' : '▾'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1 },
  flex: { flex: 1 },
  strip: { height: STRIP_HEIGHT, paddingHorizontal: spacing.sm, paddingTop: 4, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    maxWidth: 140,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  chipOpen: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  chipArrow: { fontSize: 10, color: colors.textMuted },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  focusPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  focusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  focusPillTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  body: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingLeft: spacing.xs,
    paddingRight: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  fieldDevice: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  deviceModeBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
    paddingHorizontal: spacing.xs,
  },
  deviceModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  deviceModeHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  fieldScroll: {
    flex: 1,
    height: '100%',
  },
  fieldScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '100%',
  },
  fieldEmptyTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: spacing.xs,
  },
  charsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  charTouch: {
    height: 32,
    minWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0.5,
  },
  charText: {
    fontSize: 15,
    color: colors.text,
  },
  caret: {
    width: 2,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  caretHidden: {
    opacity: 0,
  },
  caretStart: {
    marginRight: 2,
  },
  touchEdge: {
    height: 32,
    minWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchFill: {
    flex: 1,
    height: 32,
    minWidth: 20,
  },
  cursorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 4,
  },
  cursorBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursorBtnDisabled: {
    opacity: 0.3,
  },
  cursorBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryText,
    lineHeight: 18,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  placeholder: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textMuted,
    opacity: 0.75,
    flexShrink: 1,
  },
  preview: {
    marginTop: 3,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primaryText,
  },
  previewError: {
    color: colors.danger,
  },
  choices: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  choice: {
    height: 32,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  choiceTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
}));
