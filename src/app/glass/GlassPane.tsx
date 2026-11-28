/**
 * Peça de liquid glass (Android e iPhone): um canvas Skia do tamanho da peça (mais
 * uma margem para a sombra) com o shader do vidro, que calcula a aurora que está
 * atrás dela e a refrata. O conteúdo (ícone, texto) fica por cima, normal.
 * Na web o arquivo GlassPane.web.tsx marca o elemento com `glass` para o
 * <liquid-glass> original.
 *
 * Fora de uma GlassScene com Skia, a peça usa o vidro desenhado: `fallbackStyle`
 * (fundo translúcido, borda) + LiquidSheen.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PixelRatio, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LiquidSheen } from '../../keyboard/components/Glass';
import { GlassSceneContext } from './GlassScene';
import type { Frame } from './GlassScene';
import { glassProfile } from './liquidGlassSksl';
import { glassTint } from './palette';

export interface GlassPaneProps {
  style?: StyleProp<ViewStyle>;
  /** Estilo sem o vidro do Skia (fundo translúcido, borda, sombra). */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** Raio dos cantos (o vidro segue o mesmo). */
  radius: number;
  /** Cor do vidro, "#RRGGBB" (o --glass-tint do original). */
  tint?: string;
  /** Força da cor, 0–1. */
  tintStrength?: number;
  /** 0 limpo, 1 fosco. */
  frost?: number;
  /** Espessura e domo, em múltiplos do natural (1 = padrão). */
  depth?: number;
  dome?: number;
  /** Sombra 0–1. */
  shadow?: number;
  /** Separação de cor na borda. */
  chroma?: number;
  /** Brilho extra (toque). */
  pressed?: boolean;
  /** Brilho do vidro desenhado, sem o Skia. */
  sheenStrength?: number;
  /**
   * Posição da peça na janela, para peças que se movem (animação): o vidro usa
   * esta caixa a cada quadro em vez de medir a peça (medir é assíncrono e
   * ficaria um quadro atrás). Na web é ignorado: o <liquid-glass> segue o elemento.
   */
  windowBox?: Frame | null;
  children?: ReactNode;
  testID?: string;
}

/** Margem do canvas em volta da peça: a sombra vai até ~40pt abaixo. */
const MARGIN = 40;

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
  windowBox,
  children,
  testID,
}: GlassPaneProps) {
  const scene = useContext(GlassSceneContext);
  const ref = useRef<View>(null);
  const [measured, setBox] = useState<Frame | null>(null);
  const box = windowBox !== undefined ? windowBox : measured;

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      setBox(b =>
        b && Math.abs(b.x - x) < 0.5 && Math.abs(b.y - y) < 0.5 && b.width === width && b.height === height
          ? b
          : { x, y, width, height },
      );
    });
  }, []);

  // A posição na janela muda sem novo layout da peça (ex.: o cabeçalho cresce):
  // mede de novo quando a cena muda e logo depois de montar
  useEffect(() => {
    if (!scene || windowBox !== undefined) return;
    const id = setTimeout(measure, 120);
    return () => clearTimeout(id);
  }, [scene, measure, windowBox]);

  if (!scene) {
    return (
      <View testID={testID} style={[style, { borderRadius: radius }, fallbackStyle]}>
        <LiquidSheen radius={radius} strength={sheenStrength ?? (pressed ? 1.3 : 1)} />
        {children}
      </View>
    );
  }

  const { Canvas, Fill, Shader } = scene.gl.skia;
  let canvas: ReactNode = null;
  if (box) {
    const left = box.x - scene.frame.x;
    const top = box.y - scene.frame.y;
    const profile = glassProfile(box.width, box.height, { depth, dome });
    const uniforms = {
      ...scene.aurora,
      uOrigin: [left - MARGIN, top - MARGIN],
      uCenter: [left + box.width / 2, top + box.height / 2],
      uHalf: [box.width / 2, box.height / 2],
      uRadius: radius,
      uFrost: frost,
      uChroma: chroma,
      uTint: glassTint(tint, tintStrength),
      uProfile: [profile.depth, profile.rounding, profile.dome, profile.ior],
      uLight: [scene.frame.width * 0.18, -scene.frame.height * 0.25],
      uShadow: shadow,
      uPress: pressed ? 1 : 0,
      uDpr: PixelRatio.get(),
    };
    canvas = (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -MARGIN, top: -MARGIN, width: box.width + MARGIN * 2, height: box.height + MARGIN * 2 }}>
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Shader source={scene.gl.glass} uniforms={uniforms} />
          </Fill>
        </Canvas>
      </View>
    );
  }
  return (
    <View
      testID={testID}
      ref={ref}
      collapsable={false}
      onLayout={windowBox !== undefined ? undefined : measure}
      style={[style, { borderRadius: radius }]}>
      {canvas}
      {children}
    </View>
  );
}
