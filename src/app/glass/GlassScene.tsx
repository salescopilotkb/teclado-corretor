/**
 * Cena do liquid glass no app (Android e iPhone): desenha a aurora com o Skia atrás
 * de tudo e diz às peças de vidro (GlassPane) onde ela está na tela, para cada peça
 * calcular o fundo exato que fica atrás dela. Na web o arquivo GlassScene.web.tsx
 * usa o componente <liquid-glass> original.
 *
 * Fora da paleta de vidro, ou sem o Skia, fica a Aurora em SVG de antes e as peças
 * usam o vidro desenhado (LiquidSheen).
 */
import React, { createContext, useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Aurora } from '../../keyboard/components/Glass';
import { useColors } from '../../keyboard/theme';
import { glassAurora } from './palette';
import { loadGlassSkia } from './skia';
import type { GlassSkia } from './skia';

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlassSceneValue {
  /** Onde a cena está na janela (as peças medem a própria posição na janela). */
  frame: Frame;
  /** Uniforms da aurora, iguais para o fundo e para todas as peças. */
  aurora: Record<string, number | number[]>;
  gl: GlassSkia;
}

export const GlassSceneContext = createContext<GlassSceneValue | null>(null);

const sameFrame = (a: Frame | null, b: Frame) =>
  !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

export function GlassScene({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const colors = useColors();
  const gl = colors.glass ? loadGlassSkia() : null;
  const ref = useRef<View>(null);
  const [frame, setFrame] = useState<Frame | null>(null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setFrame(f => (sameFrame(f, { x, y, width, height }) ? f : { x, y, width, height }));
    });
  }, []);

  const aurora = useMemo(() => {
    if (!frame) return null;
    const a = glassAurora(colors);
    return {
      uScene: [frame.width, frame.height],
      uTime: a.time,
      uBase: a.base,
      uC0: a.spots[0],
      uC1: a.spots[1],
      uC2: a.spots[2],
      uC3: a.spots[3],
      uLines: a.lines,
      uDim: a.dim,
    };
  }, [colors, frame]);

  const value = useMemo(() => (gl && frame && aurora ? { frame, aurora, gl } : null), [gl, frame, aurora]);

  if (!gl) {
    return (
      <View style={style}>
        <Aurora />
        {children}
      </View>
    );
  }
  const { Canvas, Fill, Shader } = gl.skia;
  return (
    <View style={style}>
      <View ref={ref} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={measure}>
        {value ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <Fill>
              <Shader source={gl.backdrop} uniforms={value.aurora} />
            </Fill>
          </Canvas>
        ) : (
          <Aurora />
        )}
      </View>
      <GlassSceneContext.Provider value={value}>{children}</GlassSceneContext.Provider>
    </View>
  );
}
