/**
 * Painel de emojis do teclado (tecla 😊 ao lado da vírgula): categorias,
 * "Recentes" (os últimos usados, guardados no aparelho) e ⌫. Os emojis são
 * desenhados pela fonte do próprio celular — iguais aos do aparelho.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../i18n';
import { storage } from '../../storage/storage';
import { EMOJI_CATEGORIES } from '../typing/emojis';
import { makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';

const RECENTS_KEY = 'keyboard.recentEmojis';
const MAX_RECENTS = 32;
const COLUMNS = 8;

function readRecents(): string[] {
  try {
    const list = JSON.parse(storage.getString(RECENTS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface Props {
  /** Emoji escolhido: vai para o campo. */
  onPick: (emoji: string) => void;
  /** ⌫: um toque apaga um; segurar apaga sem parar até soltar. */
  onDelete: () => void;
  onDeleteHoldStart: () => void;
  onDeleteHoldEnd: () => void;
  /** ABC: volta para as letras. */
  onClose: () => void;
}

export const EmojiPanel = memo(({ onPick, onDelete, onDeleteHoldStart, onDeleteHoldEnd, onClose }: Props) => {
  const colors = useColors();
  const styles = useStyles();
  const [recents, setRecents] = useState<string[]>(readRecents);
  const [category, setCategory] = useState(() => (readRecents().length ? 'recent' : EMOJI_CATEGORIES[0].id));

  const tabs = useMemo(() => [{ id: 'recent', icon: '🕘', label: 'Recentes' }, ...EMOJI_CATEGORIES], []);
  const emojis = category === 'recent' ? recents : EMOJI_CATEGORIES.find(c => c.id === category)?.emojis ?? [];
  const label = tabs.find(c => c.id === category)?.label ?? '';

  const pick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      const next = [emoji, ...readRecents().filter(e => e !== emoji)].slice(0, MAX_RECENTS);
      storage.set(RECENTS_KEY, JSON.stringify(next));
      // A aba Recentes não se reorganiza enquanto a pessoa escolhe nela
      if (category !== 'recent') setRecents(next);
    },
    [category, onPick],
  );

  return (
    <View style={styles.root} testID="emoji-panel">
      <Text style={styles.title}>{t(label)}</Text>
      <FlatList
        key={category}
        style={styles.grid}
        data={emojis}
        numColumns={COLUMNS}
        keyExtractor={(e, i) => `${e}-${i}`}
        keyboardShouldPersistTaps="always"
        initialNumToRender={48}
        ListEmptyComponent={<Text style={styles.empty}>{t('Os emojis que você usar aparecem aqui.')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            testID={`emoji-${item}`}
            accessibilityRole="button"
            accessibilityLabel={item}
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
            onPress={() => pick(item)}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
      <View style={styles.bar}>
        <Pressable testID="emoji-abc" accessibilityRole="button" accessibilityLabel={t('Letras')} style={styles.barKey} onPress={onClose}>
          <Text style={styles.barKeyText}>ABC</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} keyboardShouldPersistTaps="always">
          {tabs.map(c => {
            const active = c.id === category;
            return (
              <Pressable
                key={c.id}
                testID={`emoji-tab-${c.id}`}
                accessibilityRole="tab"
                accessibilityLabel={t(c.label)}
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  setRecents(readRecents());
                  setCategory(c.id);
                }}>
                <Text style={[styles.tabIcon, !active && styles.tabIconIdle]}>{c.icon}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          testID="emoji-delete"
          accessibilityRole="button"
          accessibilityLabel={t('Apagar')}
          style={styles.barKey}
          onPress={onDelete}
          delayLongPress={400}
          onLongPress={onDeleteHoldStart}
          onPressOut={onDeleteHoldEnd}>
          <Icon name="apagar" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
});

const useStyles = makeStyles(colors => ({
  root: { flex: 1, paddingTop: spacing.xs },
  title: { fontSize: 12, fontWeight: '600', color: colors.textMuted, paddingHorizontal: spacing.md, paddingBottom: 2 },
  grid: { flex: 1, paddingHorizontal: 4 },
  cell: { flex: 1 / COLUMNS, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cellPressed: { backgroundColor: colors.surfaceAlt },
  emoji: { fontSize: 26 },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.lg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.divider },
  barKey: {
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.keySpecial,
  },
  barKeyText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabs: { gap: 2, alignItems: 'center', paddingHorizontal: 2 },
  tab: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primarySoft },
  tabIcon: { fontSize: 20 },
  tabIconIdle: { opacity: 0.55 },
}));
