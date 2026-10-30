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
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { getSellingLanguage, getTypingLanguage, setTypingLanguage, t } from '../../i18n';
import { useKeyboardBack } from '../../navigation/back';
import type { Lang } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { InputContext, KeyboardHeights } from '../../native/KeyboardBridge';
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

/**
 * Altura mínima da faixa (idiomas + campo de uma linha). A faixa cresce com o texto
 * e com o aviso de download, e o teclado cresce junto (normal + faixa): as teclas
 * ficam sempre do mesmo tamanho.
 */
const STRIP_MIN_HEIGHT = 80;
/** Linhas do campo antes de ele passar a rolar por dentro. */
const FIELD_MAX_LINES = 5;
const FIELD_LINE_HEIGHT = 20;
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
  // A tradução vai direto para o campo da conversa (não aparece no painel)
  const [, setTranslated] = useState('');
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

  // O teclado fica com a altura normal + a da faixa: quando o texto quebra linha (ou
  // aparece o aviso de download), a faixa cresce para baixo e as teclas continuam iguais
  const heights = useRef<KeyboardHeights | null>(null);
  const stripHeight = useRef(0);
  const applyHeight = useCallback(() => {
    const h = heights.current;
    if (h && stripHeight.current) KeyboardBridge.setKeyboardHeight(h.normal + stripHeight.current).catch(() => {});
  }, []);
  useEffect(() => {
    KeyboardBridge.getKeyboardHeights()
      .then(h => {
        heights.current = h;
        applyHeight();
      })
      .catch(() => {});
    // Fechou e reabriu: o teclado voltou ao normal, pede de novo
    const off = KeyboardBridge.onKeyboardShow(() => setTimeout(applyHeight, 0));
    return () => {
      off();
      KeyboardBridge.setKeyboardHeight(0).catch(() => {});
    };
  }, [applyHeight]);

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
      ? t('Baixando o tradutor (só na 1ª vez, ~30 MB)…')
      : status === 'error'
        ? error
        : null;

  const spans = useMemo(() => getCharSpans(text), [text]);
  const canMoveLeft = caretPos > 0;
  const canMoveRight = caretPos < text.length;

  return (
    <View style={styles.root} testID="translate-panel">
      {/* Faixa leve entre o menu e as teclas: a conversa e o campo dela continuam à vista */}
      <View
        style={styles.strip}
        onLayout={e => {
          const h = Math.ceil(e.nativeEvent.layout.height);
          if (h === stripHeight.current) return;
          stripHeight.current = h;
          applyHeight();
        }}>
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
                  {/* O texto num bloco só (espaçamento normal da fonte), quebrando linha e
                      crescendo para baixo até FIELD_MAX_LINES; passando disso, rola por dentro.
                      Tocar numa letra põe o cursor depois dela; no espaço vazio, no fim */}
                  <ScrollView
                    ref={scrollRef}
                    style={styles.fieldScroll}
                    contentContainerStyle={styles.fieldScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    onContentSizeChange={() => {
                      if (caretRef.current >= textRef.current.length) scrollRef.current?.scrollToEnd({ animated: false });
                    }}>
                    <Text style={styles.fieldText} onPress={() => setCaret(text.length)} suppressHighlighting>
                      {caretPos === 0 && <View style={[styles.caret, !caretVisible && styles.caretHidden]} />}
                      {spans.map((s, idx) => (
                        <React.Fragment key={`${s.start}-${idx}`}>
                          <Text onPress={() => setCaret(s.end)} suppressHighlighting>
                            {s.char}
                          </Text>
                          {caretPos === s.end && <View style={[styles.caret, !caretVisible && styles.caretHidden]} />}
                        </React.Fragment>
                      ))}
                    </Text>
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
                  <View style={[styles.caret, styles.caretEmpty, !caretVisible && styles.caretHidden]} />
                  <Text style={styles.placeholder} numberOfLines={1}>
                    {t(FIELD.placeholder)}
                  </Text>
                </Pressable>
              )}
            </Pressable>
            {/* Embaixo do campo só os avisos (baixando o idioma, erro): a tradução já
                aparece no campo da conversa, não precisa repetir aqui */}
            {focusTarget !== 'device' && statusText ? (
              <View style={styles.previewRow}>
                {status === 'downloading' && (
                  <ActivityIndicator size="small" color={colors.primaryText} style={styles.previewSpinner} />
                )}
                <Text
                  testID="translate-result"
                  style={[styles.preview, status === 'error' && styles.previewError]}
                  numberOfLines={1}
                  // Uma linha só: o aviso diminui a letra para caber inteiro
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  accessibilityLiveRegion="polite">
                  {statusText}
                </Text>
              </View>
            ) : null}
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
  strip: { minHeight: STRIP_MIN_HEIGHT, paddingHorizontal: spacing.sm, paddingTop: 4, paddingBottom: 4, gap: 4 },
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
  body: {},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 6,
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
    maxHeight: FIELD_MAX_LINES * FIELD_LINE_HEIGHT,
  },
  fieldScrollContent: {
    paddingLeft: spacing.xs,
  },
  fieldText: {
    fontSize: 15,
    lineHeight: FIELD_LINE_HEIGHT,
    color: colors.text,
  },
  fieldEmptyTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: spacing.xs,
  },
  // Dentro do texto (inline): fica onde está o cursor, também no meio de uma linha
  caret: {
    width: 2,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  caretEmpty: { marginRight: 2 },
  caretHidden: {
    opacity: 0,
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
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  previewSpinner: { transform: [{ scale: 0.7 }], width: 16, height: 16 },
  preview: {
    flex: 1,
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
