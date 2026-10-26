/**
 * Tradução simultânea no teclado (botão "Traduzir" do menu, ao lado do
 * ícone do teclado). A pessoa escreve no seu idioma numa caixa própria (o
 * teclado de letras do KEYCON escreve nela) e a tradução vai sendo escrita,
 * já traduzida, no campo de mensagem da conversa — é só enviar.
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
import { isSimulated, isTranslatorReady, translate, TRANSLATE_LANGUAGES } from '../../native/Translator';
import type { TranslateLang } from '../../native/Translator';
import { storage } from '../../storage/storage';
import { glassBorder, makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';
import { ChoiceRow, KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';

const PAIR_KEY = 'keyboard.translatePair';
/** Espera de digitação antes de traduzir (não traduz a cada letra). */
const DEBOUNCE_MS = 350;
/** O campo da conversa devolve no máximo ~200 caracteres antes do cursor. */
const CHECK_TAIL = 150;

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
      : status === 'working'
        ? t('Traduzindo...')
        : status === 'error'
          ? error
          : null;

  return (
    <View style={styles.root} testID="translate-panel">
      <View style={styles.head}>
        <Pressable testID="translate-source" accessibilityRole="button" style={styles.langBtn} onPress={() => setPicking(p => (p === 'source' ? null : 'source'))}>
          <Text style={styles.langLabel}>{t('De')}</Text>
          <Text style={styles.langName} numberOfLines={1}>
            {labelOf(pair.source)}
          </Text>
        </Pressable>
        <Pressable testID="translate-swap" accessibilityRole="button" accessibilityLabel={t('Inverter idiomas')} hitSlop={6} style={styles.swap} onPress={swap}>
          <Icon name="traduzir" size={18} color={colors.primary} />
        </Pressable>
        <Pressable testID="translate-target" accessibilityRole="button" style={styles.langBtn} onPress={() => setPicking(p => (p === 'target' ? null : 'target'))}>
          <Text style={styles.langLabel}>{t('Para')}</Text>
          <Text style={styles.langName} numberOfLines={1}>
            {labelOf(pair.target)}
          </Text>
        </Pressable>
        <Pressable testID="translate-close" accessibilityRole="button" accessibilityLabel={t('Fechar tradução')} hitSlop={8} style={styles.close} onPress={onClose}>
          <Icon name="fechar" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="always">
        {picking ? (
          <ChoiceRow
            options={TRANSLATE_LANGUAGES.map(l => ({ value: l.id as TranslateLang, label: l.label }))}
            value={pair[picking]}
            onChange={id => choose(picking, id)}
          />
        ) : null}
        <KeyboardFormField spec={FIELD} value={text} active onPress={() => form.setActive('text')} />
        <View style={styles.result} testID="translate-result">
          <Text style={styles.resultLabel}>{t('Vai para a conversa ({lang})', { lang: labelOf(pair.target) })}</Text>
          <Text style={[styles.resultText, !translated && styles.resultEmpty]} numberOfLines={4}>
            {translated || t('A tradução aparece aqui e já entra no campo de mensagem.')}
          </Text>
          {statusText ? <Text style={[styles.status, status === 'error' && styles.statusError]}>{statusText}</Text> : null}
          {isSimulated ? <Text style={styles.status}>{t('Versão de testes: tradução simulada.')}</Text> : null}
        </View>
      </ScrollView>

      <KeyboardFormKeys sink={form.sink} activeKey={`text-${round}`} spec={FIELD} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  langBtn: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  langLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  langName: { fontSize: 14, fontWeight: '600', color: colors.text },
  swap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: spacing.sm, gap: spacing.sm, paddingBottom: spacing.sm },
  result: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft, gap: 4 },
  resultLabel: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
  resultText: { fontSize: 15, lineHeight: 21, color: colors.text },
  resultEmpty: { color: colors.textMuted },
  status: { fontSize: 12, color: colors.textMuted },
  statusError: { color: colors.danger },
}));
