/**
 * Etiquetas dos clientes do CRM (app e teclado): chip colorido (a cor vem do
 * nome da etiqueta, sempre a mesma) e o seletor que liga/desliga etiquetas.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { tagColor } from '../../crm/crm';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, useColors } from '../theme';

export function TagChip({
  tag,
  selected,
  small,
  onPress,
  testID,
}: {
  tag: string;
  /** No seletor: ligada (fundo da cor da etiqueta). */
  selected?: boolean;
  small?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const color = tagColor(tag);
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, small && styles.textSmall, selected && { color }]} numberOfLines={1}>
        {tag}
      </Text>
    </>
  );
  const style = [styles.chip, small && styles.chipSmall, selected && { backgroundColor: `${color}26`, borderColor: color }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={tag}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/** Etiquetas do cliente, só para ver (na lista e na ficha). */
export function TagList({ tags, max }: { tags?: string[]; max?: number }) {
  const styles = useStyles();
  if (!tags?.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <View style={styles.wrap}>
      {shown.map(tag => (
        <TagChip key={tag} tag={tag} small />
      ))}
      {max && tags.length > max ? <Text style={styles.more}>+{tags.length - max}</Text> : null}
    </View>
  );
}

/**
 * Liga/desliga etiquetas: as que já existem nos clientes e as do cliente.
 * "+ Nova etiqueta" chama `onNew` (cada tela pede o nome do seu jeito).
 */
export function TagPicker({
  available,
  selected,
  onToggle,
  onNew,
}: {
  available: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onNew?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const lower = new Set(available.map(x => x.toLowerCase()));
  const all = [...available, ...selected.filter(x => !lower.has(x.toLowerCase()))];
  const isOn = (tag: string) => selected.some(x => x.toLowerCase() === tag.toLowerCase());
  return (
    <View style={styles.wrap}>
      {all.map(tag => (
        <TagChip key={tag} testID={`tag-${tag}`} tag={tag} selected={isOn(tag)} onPress={() => onToggle(tag)} />
      ))}
      {onNew && (
        <Pressable
          testID="tag-new"
          accessibilityRole="button"
          onPress={onNew}
          style={({ pressed }) => [styles.chip, styles.newChip, pressed && styles.pressed]}>
          <Text style={[styles.text, { color: colors.primaryText }]}>{t('+ Nova etiqueta')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Filtro da lista: "Todas" + uma por etiqueta (rola para o lado). */
export function TagFilter({ tags, value, onChange }: { tags: string[]; value: string | null; onChange: (tag: string | null) => void }) {
  const styles = useStyles();
  if (!tags.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filter} keyboardShouldPersistTaps="always">
      <Pressable
        testID="tag-filter-all"
        accessibilityRole="radio"
        accessibilityState={{ selected: value === null }}
        onPress={() => onChange(null)}
        style={[styles.chip, value === null && styles.allOn]}>
        <Text style={[styles.text, value === null && styles.allOnText]}>{t('Todas as etiquetas')}</Text>
      </Pressable>
      {tags.map(tag => (
        <TagChip
          key={tag}
          testID={`tag-filter-${tag}`}
          tag={tag}
          selected={value?.toLowerCase() === tag.toLowerCase()}
          onPress={() => onChange(value?.toLowerCase() === tag.toLowerCase() ? null : tag)}
        />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: { gap: 6, paddingRight: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  chipSmall: { minHeight: 22, paddingHorizontal: 8, gap: 4 },
  newChip: { borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: 'transparent' },
  allOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  allOnText: { color: colors.primaryText, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  textSmall: { fontSize: 11 },
  more: { fontSize: 11, color: colors.textMuted, alignSelf: 'center' },
  pressed: { opacity: 0.7 },
}));
