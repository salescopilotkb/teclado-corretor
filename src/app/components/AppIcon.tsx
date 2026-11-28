/**
 * Ícone de "app" do Início e da barra de baixo: quadrado de cantos redondos com o
 * nome embaixo, como na tela inicial de um celular. Na paleta de vidro, o quadrado
 * é liquid glass de verdade (GlassPane: refrata a aurora atrás dele) e cresce um
 * pouco ao ser tocado. `plain`: o vidro desenhado, sem refração (telas com muitos
 * ícones, como o editor da barra — a web desenha no máximo 16 peças por cena).
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../keyboard/components/Icon';
import { LiquidSheen } from '../../keyboard/components/Glass';
import { GlassPane } from '../glass/GlassPane';
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
  /** Sem refração (vidro desenhado). */
  plain?: boolean;
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
  plain,
  onPress,
  onLongPress,
  testID,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const color = tint(colors);
  const tileRadius = Math.round(size * 0.23);
  const dark = colors.scheme === 'dark';
  const liquid = colors.glass && !plain;
  // No vidro de verdade o símbolo é branco no escuro (como os ícones do iOS 26); no claro, a cor
  const glyph = liquid && dark ? '#FFFFFF' : color;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={checked === undefined ? { selected: !!active } : { checked }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.wrap,
        { width: size + 28 },
        // Vidro: cresce ao tocar (como o liquid glass); fora dele, apaga
        (dimmed || (pressed && !colors.glass)) && styles.pressed,
      ]}>
      {({ pressed }) => (
        <>
          {liquid ? (
            <GlassPane
              radius={tileRadius}
              tint={color}
              // Vidro quase transparente (como os botões da demo): só um toque da cor do app
              tintStrength={0.1}
              pressed={pressed}
              style={[
                styles.liquidTile,
                { width: size, height: size },
                pressed && styles.tilePressed,
                checked && { borderColor: colors.primary, borderWidth: 2 },
              ]}
              fallbackStyle={[styles.tile, { backgroundColor: withAlpha(color, dark ? 0.24 : 0.16) }]}>
              <Icon name={icon} size={Math.round(size * 0.46)} color={glyph} />
            </GlassPane>
          ) : (
            <View
              style={[
                styles.tile,
                {
                  width: size,
                  height: size,
                  // Cantos de ícone de celular (~23% do lado)
                  borderRadius: tileRadius,
                  backgroundColor: withAlpha(color, dark ? 0.24 : 0.16),
                },
                pressed && colors.glass && styles.tilePressed,
                checked && { borderColor: colors.primary, borderWidth: 2 },
              ]}>
              <LiquidSheen radius={tileRadius} strength={pressed ? 1.3 : 1} />
              <Icon name={icon} size={Math.round(size * 0.46)} color={color} />
            </View>
          )}
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
        </>
      )}
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
    // Sombra suave do vidro (iOS/web); no Android a elevação marcaria o fundo translúcido
    ...(colors.glass
      ? {
          shadowColor: '#000',
          shadowOpacity: colors.scheme === 'dark' ? 0.35 : 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }
      : {}),
  },
  /** Peça do liquid glass: o vidro (com a sombra) vem do shader. */
  liquidTile: { alignItems: 'center', justifyContent: 'center' },
  /** Toque no vidro: cresce ~6% (o --glass-press do liquid glass). */
  tilePressed: { transform: [{ scale: 1.06 }] },
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
