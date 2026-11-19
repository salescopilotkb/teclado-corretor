/**
 * Vidro Liquid Glass — versão WEB (site de testes): o navegador não tem o vidro do
 * iOS 26, então é sempre o vidro desenhado pelo app (o mesmo do Android).
 */
import React from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function hasLiquidGlass(): boolean {
  return false;
}

interface Props {
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  interactive?: boolean;
  tintColor?: string;
  children?: ReactNode;
  testID?: string;
}

export function LiquidGlass({ style, fallbackStyle, children, testID }: Props) {
  return (
    <View testID={testID} style={[style, fallbackStyle]}>
      {children}
    </View>
  );
}
