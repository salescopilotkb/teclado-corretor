/**
 * Peças do Liquid Glass usadas pelo app e pelo teclado (guia "KEYCON Liquid
 * Glass"): a aurora do fundo e o reflexo dos botões coral.
 */
import React, { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { radius as radii, useColors } from '../theme';

/**
 * Quatro manchas sobre o canvas: coral no alto à esquerda, pêssego no alto à
 * direita, azul frio embaixo e névoa embaixo à esquerda.
 *
 * `dark`: força da mancha no tema escuro. O título e o subtítulo das telas
 * ficam sobre a aurora; com o coral a 40%, o subtítulo cinza ainda passa
 * 4,5:1 (a 100% cairia para 3,5:1).
 */
const SPOTS = [
  { id: 'coral', key: 'auroraCoral', cx: '12%', cy: '6%', rx: '75%', ry: '42%', fade: 0.62, dark: 0.4 },
  { id: 'peach', key: 'auroraPeach', cx: '95%', cy: '20%', rx: '60%', ry: '32%', fade: 0.6, dark: 0.55 },
  { id: 'dusk', key: 'auroraDusk', cx: '75%', cy: '100%', rx: '90%', ry: '45%', fade: 0.65, dark: 0.9 },
  { id: 'mist', key: 'auroraMist', cx: '0%', cy: '85%', rx: '70%', ry: '35%', fade: 0.7, dark: 1 },
] as const;

/**
 * Fundo com aurora, atrás de tudo. `intensity` (0–1) suaviza as manchas: o
 * teclado usa menos, para não competir com as teclas.
 *
 * O SVG recebe o tamanho medido (e é refeito quando ele muda): com "100%",
 * no Android ele não se redesenha quando o teclado cresce (Atalhos, Agenda,
 * CRM, tradução) e a parte nova ficava sem a aurora — o fundo "dividido".
 */
export const Aurora = memo(({ intensity = 1 }: { intensity?: number }) => {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    const height = Math.round(e.nativeEvent.layout.height);
    setSize(s => (s && s.width === width && s.height === height ? s : { width, height }));
  };
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]} pointerEvents="none" onLayout={onLayout}>
      {size && (
        <Svg key={`${size.width}x${size.height}`} width={size.width} height={size.height}>
          <Defs>
            {SPOTS.map(s => (
              <RadialGradient key={s.id} id={`aurora-${s.id}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fx={s.cx} fy={s.cy}>
                <Stop
                  offset="0"
                  stopColor={colors[s.key]}
                  stopOpacity={(colors.scheme === 'dark' ? s.dark : 1) * intensity}
                />
                <Stop offset={String(s.fade)} stopColor={colors[s.key]} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {SPOTS.map(s => (
            <Rect key={s.id} width={size.width} height={size.height} fill={`url(#aurora-${s.id})`} />
          ))}
        </Svg>
      )}
    </View>
  );
});

/**
 * Liquid glass desenhado pelo app (o vidro do sistema do iOS 26 precisa da nova
 * arquitetura do React Native). Imita as camadas de uma placa de vidro curva:
 *  1. face: brilho branco no alto que some antes do meio e volta fraco embaixo
 *     (a luz que atravessa o vidro e sai pela borda de baixo);
 *  2. ponto de luz (especular) no canto de cima à esquerda;
 *  3. aro: contorno interno em degradê, claro nos cantos de cima à esquerda e de
 *     baixo à direita e apagado no meio, como a borda grossa do vidro refletindo.
 * Primeiro filho da peça de vidro, que tem o fundo translúcido e o raio. Só
 * aparece na paleta de vidro. `strength` (0–1.5) regula o brilho.
 *
 * O SVG recebe o tamanho medido: o aro precisa de medidas exatas para seguir o
 * raio da peça (com "100%" a borda sairia esticada).
 */
export const LiquidSheen = memo(({ radius, strength = 1 }: { radius: number; strength?: number }) => {
  const colors = useColors();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  if (!colors.glass) return null;
  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    const height = Math.round(e.nativeEvent.layout.height);
    setSize(s => (s && s.width === width && s.height === height ? s : { width, height }));
  };
  const dark = colors.scheme === 'dark';
  // No escuro o branco aparece mais: menos brilho para não "lavar" a cor
  const k = (dark ? 0.65 : 1) * strength;
  const rim = 1.5;
  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      {size && size.width > rim * 2 && size.height > rim * 2 && (
        <Svg key={`${size.width}x${size.height}`} width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id="keycon-liquid-face" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.34 * k} />
              <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.06 * k} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.82" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.16 * k} />
            </LinearGradient>
            <RadialGradient id="keycon-liquid-spec" cx="24%" cy="4%" rx="55%" ry="48%" fx="24%" fy="4%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42 * k} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="keycon-liquid-rim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={Math.min(1, 0.95 * k + 0.1)} />
              <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.12 * k} />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.08 * k} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.6 * k} />
            </LinearGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill="url(#keycon-liquid-face)" />
          <Rect width={size.width} height={size.height} fill="url(#keycon-liquid-spec)" />
          <Rect
            x={rim / 2}
            y={rim / 2}
            width={size.width - rim}
            height={size.height - rim}
            rx={Math.max(0, Math.min(radius, size.width / 2, size.height / 2) - rim / 2)}
            fill="none"
            stroke="url(#keycon-liquid-rim)"
            strokeWidth={rim}
          />
        </Svg>
      )}
    </View>
  );
});

/**
 * Reflexo do botão coral de vidro: degradê vertical que some antes do meio
 * (sem linha dura atravessando o texto) e uma leve refração embaixo.
 * Primeiro filho do botão; só aparece na paleta de vidro. `radius` = o raio
 * do botão (pílula no app; cantos discretos no teclado).
 */
export const CoralSheen = memo(({ radius = radii.pill }: { radius?: number }) => {
  const colors = useColors();
  if (!colors.glass) return null;
  return (
    // Recorte próprio na forma do botão: o botão fica sem overflow e mantém a sombra
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="keycon-coral-sheen" x1="0" y1="0" x2="0" y2="1">
            {/* Topo suave: o texto branco precisa do coral atrás dele */}
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.24} />
            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
            {/* Refração: um pouco de grafite embaixo */}
            <Stop offset="1" stopColor="#242833" stopOpacity={0.12} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#keycon-coral-sheen)" />
      </Svg>
    </View>
  );
});
