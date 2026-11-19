/**
 * Vidro Liquid Glass do iOS 26 (expo-glass-effect), com volta segura para o vidro
 * desenhado pelo próprio app.
 *
 * Só usa o vidro do sistema quando TUDO isto vale:
 *  • iPhone (no Android não existe; o expo-glass-effect lá é uma View comum);
 *  • app compilado com o Xcode 26 e rodando no iOS 26 (isLiquidGlassAvailable);
 *  • o módulo nativo do Expo está carregado. No TECLADO do iPhone (extensão, outro
 *    processo) os módulos do Expo não são ligados: lá fica sempre o vidro do app.
 *
 * O pacote é carregado só na primeira vez que alguém pergunta (require dentro da
 * função): importá-lo no topo registraria a view nativa já ao abrir o teclado.
 */
import React from 'react';
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type GlassModule = typeof import('expo-glass-effect');

let glass: GlassModule | null | undefined;

function loadGlass(): GlassModule | null {
  if (glass !== undefined) return glass;
  glass = null;
  if (Platform.OS !== 'ios') return glass;
  // Sem o objeto global do Expo (ex.: na extensão do teclado), nem tenta
  if (!(globalThis as { expo?: unknown }).expo) return glass;
  try {
    const mod: GlassModule = require('expo-glass-effect');
    if (mod.isLiquidGlassAvailable()) glass = mod;
  } catch {
    glass = null;
  }
  return glass;
}

/** true quando o app pode usar o vidro Liquid Glass do sistema (iOS 26). */
export function hasLiquidGlass(): boolean {
  return loadGlass() !== null;
}

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Estilo usado SEM o vidro do sistema (fundo translúcido, borda, sombra do app). */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** Vidro que reage ao toque (botões e barras). */
  interactive?: boolean;
  /** Cor por cima do vidro (opcional). */
  tintColor?: string;
  children?: ReactNode;
  testID?: string;
}

/**
 * Superfície de vidro: no iOS 26 é o vidro do sistema; nos outros casos é uma View
 * com `style` + `fallbackStyle` (o vidro que o app já desenhava).
 */
export function LiquidGlass({ style, fallbackStyle, interactive, tintColor, children, testID }: Props) {
  const mod = loadGlass();
  if (!mod) {
    return (
      <View testID={testID} style={[style, fallbackStyle]}>
        {children}
      </View>
    );
  }
  const { GlassView } = mod;
  return (
    <GlassView testID={testID} style={style} glassEffectStyle="regular" isInteractive={interactive} tintColor={tintColor}>
      {children}
    </GlassView>
  );
}
