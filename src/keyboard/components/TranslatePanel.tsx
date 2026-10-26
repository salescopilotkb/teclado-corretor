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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getSellingLanguage, getTypingLanguage, setTypingLanguage, t } from '../../i18n';
import type { Lang } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { isTranslatorReady, translate, TRANSLATE_LANGUAGES } from '../../native/Translator';
import type { TranslateLang } from '../../native/Translator';
import { storage } from '../../storage/storage';
import { glassBorder, makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';
import { KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';

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

export function TranslatePanel({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [pair, setPair] = useState(initialPair);
  const [picking, setPicking] = useState<'source' | 'target' | null>(null);
  const [translated, setTranslated] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'downloading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const form = useKeyboardForm([FIELD], { text: '' });
  const text = form.values.text ?? '';

  /** O que o painel escreveu por último no campo da conversa. */
  const inserted = useRef('');
  /** Muda a cada mensagem nova: o teclado de letras recomeça (maiúscula no início). */
  const [round, setRound] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    storage.set(PAIR_KEY, JSON.stringify(pair));
  }, [pair]);

  // O corretor do teclado segue o idioma de origem enquanto o painel está aberto
  useEffect(() => {
    const before = getTypingLanguage();
    if (isKeyboardLang(pair.source)) setTypingLanguage(pair.source);
    return () => setTypingLanguage(before);
  }, [pair.source]);

  /** Uma escrita no campo da conversa por vez (duas ao mesmo tempo embaralhariam o texto). */
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Escreve a tradução no campo da conversa, trocando só o que o painel escreveu. */
  const syncChat = useCallback((next: string) => {
    queue.current = queue.current.then(() => writeChat(next)).catch(() => {});
    return queue.current;
  }, []);

  const writeChat = async (next: string) => {
    const prev = inserted.current;
    if (next === prev) return;
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
  };

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
        setError(e instanceof Error ? t(e.message) : t('Não foi possível traduzir.'));
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, pair, syncChat]);

  // Mensagem enviada (o campo da conversa esvaziou): limpa a caixa para a próxima
  const { setValue } = form;
  useEffect(
    () =>
      KeyboardBridge.onSelectionChange(async () => {
        if (!inserted.current) return;
        const { before } = await KeyboardBridge.getInputContext().catch(() => ({ before: 'x' }));
        if (before === '') {
          inserted.current = '';
          setValue('text', '');
          setTranslated('');
          setRound(r => r + 1);
        }
      }),
    [setValue],
  );

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
            <View style={styles.field} testID="kbfield-text" accessible accessibilityLabel={t(FIELD.label)}>
              <Text style={[styles.fieldText, !text && styles.muted]} numberOfLines={1}>
                {text ? tail(text, FIELD_TAIL) : t(FIELD.placeholder)}
              </Text>
              <View style={styles.caret} />
            </View>
            <Text
              testID="translate-result"
              style={[styles.preview, status === 'error' && styles.previewError]}
              numberOfLines={1}
              accessibilityLiveRegion="polite">
              {statusText ?? (translated ? `→ ${tail(translated, PREVIEW_TAIL)}` : ' ')}
            </Text>
          </View>
        )}
      </View>

      <KeyboardFormKeys sink={form.sink} activeKey={`text-${round}`} spec={FIELD} />
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
  body: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  fieldText: { fontSize: 15, color: colors.text, flexShrink: 1 },
  muted: { color: colors.textMuted },
  caret: { width: 2, height: 18, backgroundColor: colors.primary, marginLeft: 1 },
  preview: { marginTop: 3, paddingHorizontal: spacing.md, fontSize: 13, lineHeight: 18, color: colors.primaryText },
  previewError: { color: colors.danger },
  choices: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  choice: { height: 32, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface },
  choiceSelected: { backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  choiceTextSelected: { color: colors.primaryText, fontWeight: '600' },
}));
