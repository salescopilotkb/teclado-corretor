/**
 * Busca dentro do teclado (Produtos, Arquivos, Atalhos e CRM).
 *
 * Como nos formulários do teclado, o campo é só um visor: o teclado de letras
 * do KEYCON escreve nele (um TextInput tiraria o foco da conversa). Os
 * resultados filtram a cada letra. Sem maiúscula automática, mas com o corretor;
 * o cursor (laranja) anda tocando numa letra ou nas setas ‹ ›.
 */
import React, { useEffect, useState } from 'react';
import { useKeyboardBack } from '../../navigation/back';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../i18n';
import { glassBorder, makeStyles, radius, spacing, touchTarget, useColors } from '../theme';
import { Icon } from './Icon';
import { KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';

/** Minúsculas e sem acento: "Vestido" acha "vestído", "cafe" acha "Café". */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Todas as palavras da busca aparecem em algum dos textos ("camisa azul" acha "Camisa Polo Azul"). */
export function matches(query: string, ...texts: Array<string | undefined | null>): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const haystack = normalize(texts.filter(Boolean).join(' '));
  return words.every(w => haystack.includes(w));
}

/** Resultados mostrados no máximo (o teclado não precisa listar milhares). */
export const MAX_RESULTS = 50;

/** Campo de busca fechado: toque para abrir a busca. */
export function SearchLauncher({ placeholder, onPress, testID }: { placeholder: string; onPress: () => void; testID?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      onPress={onPress}
      style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}>
      <Icon name="busca" size={18} color={colors.textMuted} />
      <Text style={styles.placeholder} numberOfLines={1}>
        {placeholder}
      </Text>
    </Pressable>
  );
}

const SEARCH_FIELD: FormFieldSpec[] = [{ key: 'q', label: '', placeholder: '', kind: 'search' }];

/**
 * Busca aberta: campo, resultados e o teclado de letras. `children` recebe o
 * texto digitado e devolve os resultados (ou nada, para mostrar a dica).
 */
export function SearchPanel({
  placeholder,
  onClose,
  children,
  testID,
}: {
  placeholder: string;
  onClose: () => void;
  children: (query: string) => ReactNode;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  useKeyboardBack(onClose);
  const form = useKeyboardForm(SEARCH_FIELD, { q: '' });
  const query = form.values.q ?? '';
  const results = query.trim() ? children(query) : null;
  const chars = Array.from(query);
  // Posição do cursor em letras (o texto pode ter emoji: 2 unidades numa letra só)
  const caretChar = Array.from(query.slice(0, form.caret)).length;
  const moveTo = (charIndex: number) => {
    form.moveCaret(chars.slice(0, Math.max(0, charIndex)).join('').length);
    // O teclado de letras relê o texto até o cursor (sugestões e correção)
    setMoved(m => m + 1);
  };
  const [moved, setMoved] = useState(0);
  // Cursor piscando, como no tradutor
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(timer);
  }, []);
  const caretMark = <Text style={[styles.caretText, !blink && styles.caretHidden]}>|</Text>;
  return (
    <View style={styles.flex} testID={testID}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Fechar busca')} hitSlop={8} style={styles.back} onPress={onClose}>
          <Icon name="voltar" size={20} color={colors.textMuted} />
        </Pressable>
        <View style={styles.field} testID="search-field">
          <Icon name="busca" size={18} color={colors.primaryText} />
          <View style={styles.valueRow}>
            {query ? (
              // Toque numa letra: o cursor vai para depois dela; no espaço vazio, para o fim
              <Text style={styles.value} numberOfLines={1} ellipsizeMode="head" onPress={() => moveTo(chars.length)} suppressHighlighting>
                {caretChar === 0 && caretMark}
                {chars.map((c, i) => (
                  <React.Fragment key={i}>
                    <Text onPress={() => moveTo(i + 1)} suppressHighlighting>
                      {c}
                    </Text>
                    {caretChar === i + 1 && caretMark}
                  </React.Fragment>
                ))}
              </Text>
            ) : (
              <Text style={[styles.value, styles.placeholder]} numberOfLines={1}>
                {placeholder}
              </Text>
            )}
          </View>
          {!!query && (
            <View style={styles.cursorControls}>
              <Pressable
                testID="search-caret-left"
                accessibilityRole="button"
                accessibilityLabel={t('Voltar caractere')}
                hitSlop={6}
                disabled={caretChar === 0}
                style={[styles.cursorBtn, caretChar === 0 && styles.cursorBtnDisabled]}
                onPress={() => moveTo(caretChar - 1)}>
                <Text style={styles.cursorBtnText}>‹</Text>
              </Pressable>
              <Pressable
                testID="search-caret-right"
                accessibilityRole="button"
                accessibilityLabel={t('Avançar caractere')}
                hitSlop={6}
                disabled={caretChar >= chars.length}
                style={[styles.cursorBtn, caretChar >= chars.length && styles.cursorBtnDisabled]}
                onPress={() => moveTo(caretChar + 1)}>
                <Text style={styles.cursorBtnText}>›</Text>
              </Pressable>
              <Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel={t('Limpar')} hitSlop={8} onPress={() => form.setValue('q', '')}>
                <Icon name="fechar" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.results} keyboardShouldPersistTaps="always">
        {results ?? <Text style={styles.hint}>{t('Digite para buscar.')}</Text>}
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey={`q-${moved}`} spec={SEARCH_FIELD[0]} />
    </View>
  );
}

/** "Nada encontrado para …" (cada seção mostra quando a lista sai vazia). */
export function NoResults({ query }: { query: string }) {
  const styles = useStyles();
  return <Text style={styles.hint}>{t('Nada encontrado para "{query}".', { query: query.trim() })}</Text>;
}

/** Título de grupo nos resultados ("Pastas", "Arquivos"...). */
export function ResultsSection({ title }: { title: string }) {
  const styles = useStyles();
  return <Text style={styles.section}>{title}</Text>;
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  launcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 38,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  placeholder: { flex: 1, fontSize: 14, color: colors.textMuted },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg,
  },
  back: { padding: spacing.xs },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  valueRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 15, color: colors.text, flexShrink: 1 },
  // Cursor: um "|" laranja dentro do texto; para piscar fica transparente (sem mudar de largura)
  caretText: { color: colors.primary, fontWeight: '300', letterSpacing: -1 },
  caretHidden: { color: 'transparent' },
  cursorControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cursorBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  cursorBtnDisabled: { opacity: 0.35 },
  cursorBtnText: { fontSize: 18, lineHeight: 20, fontWeight: '600', color: colors.text },
  results: { padding: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xs },
}));
