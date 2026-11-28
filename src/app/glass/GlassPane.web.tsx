/**
 * Peça de liquid glass na web: marca o elemento com `glass` e passa os ajustes pelas
 * propriedades CSS do <liquid-glass> original (--glass-tint, --glass-depth...). O
 * fundo do elemento fica transparente: quem desenha o vidro é a cena.
 * Fora da paleta de vidro, usa o vidro desenhado (fallbackStyle + LiquidSheen).
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { LiquidSheen } from '../../keyboard/components/Glass';
import { useColors } from '../../keyboard/theme';
import type { GlassPaneProps } from './GlassPane';
import { glassTint } from './palette';

export function GlassPane({
  style,
  fallbackStyle,
  radius,
  tint,
  tintStrength = 0.2,
  frost = 0,
  depth = 1,
  dome = 1,
  shadow = 1,
  chroma = 0.008,
  pressed,
  sheenStrength,
  children,
  testID,
}: GlassPaneProps) {
  const colors = useColors();
  const ref = useRef<View>(null);
  const glass = colors.glass;

  useEffect(() => {
    // Na web o ref do View é o elemento do DOM (o tsconfig do app não tem os tipos do DOM)
    const el = ref.current as unknown as {
      setAttribute(name: string, value: string): void;
      removeAttribute(name: string): void;
      style: { setProperty(name: string, value: string): void };
    } | null;
    if (!el || !glass) return;
    const [r, g, b, a] = glassTint(tint, tintStrength);
    el.setAttribute('glass', '');
    el.style.setProperty('--glass-tint', `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`);
    el.style.setProperty('--glass-frost', String(frost));
    el.style.setProperty('--glass-depth', String(depth));
    el.style.setProperty('--glass-dome', String(dome));
    el.style.setProperty('--glass-shadow', String(shadow));
    el.style.setProperty('--glass-chroma', String(chroma));
    // O app já faz a peça crescer ao tocar; o componente só acende o brilho
    el.style.setProperty('--glass-press', '1');
    return () => el.removeAttribute('glass');
  }, [glass, tint, tintStrength, frost, depth, dome, shadow, chroma]);

  if (!glass) {
    return (
      <View testID={testID} style={[style, { borderRadius: radius }, fallbackStyle]}>
        <LiquidSheen radius={radius} strength={sheenStrength ?? (pressed ? 1.3 : 1)} />
        {children}
      </View>
    );
  }
  return (
    <View testID={testID} ref={ref} style={[style, { borderRadius: radius, backgroundColor: 'transparent' }]}>
      {children}
    </View>
  );
}
