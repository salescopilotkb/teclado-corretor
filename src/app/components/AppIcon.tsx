/**
 * Ícone de "app" do Início e da barra de baixo: quadrado de cantos redondos com o
 * nome embaixo, como na tela inicial de um celular.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { glassBorder, makeStyles, useColors } from '../../keyboard/theme';
import type { Palette } from '../../keyboard/theme';
import { withAlpha } from '../homeApps';

interface Props {
  label: string;
  icon: IconName;
  tint: (colors: Palette) => string;
  /** Lado do quadrado. */
  size?: number;
  /** Bolinha no canto: texto curto (ex.: "3") ou só o ponto (true). */
  badge?: string | true;
  /** Marcado no editor da barra. */
  checked?: boolean;
  /** Item atual da barra (nome em destaque). */
  active?: boolean;
  /** Apagado (ex.: barra cheia no editor). */
  dimmed?: boolean;
  /** Nome em uma linha (barra) ou até duas (grade). */
  labelLines?: number;
  labelSize?: number;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

export function AppIcon({
  label,
  icon,
  tint,
  size = 60,
  badge,
  checked,
  active,
  dimmed,
  labelLines = 2,
  labelSize = 12,
  onPress,
  onLongPress,
  testID,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const color = tint(colors);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={checked === undefined ? { selected: !!active } : { checked }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.wrap, { width: size + 28 }, (pressed || dimmed) && styles.pressed]}>
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            // Cantos de ícone de celular (~23% do lado)
            borderRadius: Math.round(size * 0.23),
            backgroundColor: withAlpha(color, colors.scheme === 'dark' ? 0.22 : 0.14),
          },
          checked && { borderColor: colors.primary, borderWidth: 2 },
        ]}>
        <Icon name={icon} size={Math.round(size * 0.46)} color={color} />
      </View>
      {badge ? (
        <View style={[styles.badge, badge === true && styles.dot, { right: 14 - 6 }]}>
          {badge !== true && <Text style={styles.badgeText}>{badge}</Text>}
        </View>
      ) : null}
      {checked ? (
        <View style={[styles.check, { right: 14 - 6 }]}>
          <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} />
        </View>
      ) : null}
      <Text
        style={[styles.label, { fontSize: labelSize, lineHeight: labelSize + 3 }, active && styles.labelActive]}
        numberOfLines={labelLines}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: { alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.55 },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    ...glassBorder(colors),
  },
  label: { color: colors.text, fontWeight: '500', textAlign: 'center' },
  labelActive: { color: colors.primaryText, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  dot: { minWidth: 14, width: 14, height: 14, top: -4, paddingHorizontal: 0 },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
  check: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
}));
