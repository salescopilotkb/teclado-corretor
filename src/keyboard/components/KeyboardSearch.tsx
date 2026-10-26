/**
 * Busca dentro do teclado (Produtos, Arquivos, Atalhos e CRM).
 *
 * Como nos formulários do teclado, o campo é só um visor: o teclado de letras
 * do KEYCON escreve nele (um TextInput tiraria o foco da conversa). Os
 * resultados filtram a cada letra; sem maiúscula nem correção automática.
 */
import React from 'react';
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
  const form = useKeyboardForm(SEARCH_FIELD, { q: '' });
  const query = form.values.q ?? '';
  const results = query.trim() ? children(query) : null;
  return (
    <View style={styles.flex} testID={testID}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Fechar busca')} hitSlop={8} style={styles.back} onPress={onClose}>
          <Icon name="voltar" size={20} color={colors.textMuted} />
        </Pressable>
        <View style={styles.field} testID="search-field">
          <Icon name="busca" size={18} color={colors.primaryText} />
          <View style={styles.valueRow}>
            <Text style={[styles.value, !query && styles.placeholder]} numberOfLines={1}>
              {query || placeholder}
            </Text>
            {!!query && <View style={styles.caret} />}
          </View>
          {!!query && (
            <Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel={t('Limpar')} hitSlop={8} onPress={() => form.setValue('q', '')}>
              <Icon name="fechar" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.results} keyboardShouldPersistTaps="always">
        {results ?? <Text style={styles.hint}>{t('Digite para buscar.')}</Text>}
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey="q" spec={SEARCH_FIELD[0]} />
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
  caret: { width: 2, height: 18, backgroundColor: colors.primary, marginLeft: 1 },
  results: { padding: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xs },
}));
