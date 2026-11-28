/**
 * Cena do liquid glass na web (/app e simulador): o componente <liquid-glass>
 * original de zerowing (https://zerowing.in/glass, MIT). As peças (GlassPane.web.tsx)
 * são elementos marcados com `glass` dentro dela. Fora da paleta de vidro, fica a
 * Aurora em SVG.
 *
 * O fundo: a aurora embutida no componente sempre desenha linhas de contorno (a
 * "textura de água"), sem opção para tirar. Então a cena recebe como fundo uma
 * imagem da MESMA aurora do celular (liquidGlassSksl.ts), lisa e parada, gerada aqui.
 */
import React, { createElement, useCallback } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import '@zerowing/liquid-glass';
import { Aurora } from '../../keyboard/components/Glass';
import { useColors } from '../../keyboard/theme';
import { glassAurora } from './palette';
import type { GlassAurora, Rgb } from './palette';

/**
 * O componente põe o conteúdo num bloco interno (.content, no shadow DOM) que não
 * estica. Para o layout do React Native (flex em coluna, altura toda) funcionar
 * dentro dele, acrescenta uma regra ao shadow DOM do componente.
 */
const CONTENT_CSS = '.content { display: flex; flex-direction: column; height: 100%; min-height: 0; }';

// O tsconfig do app não tem os tipos do DOM: só o que é usado aqui
type Host = {
  shadowRoot: { adoptedStyleSheets?: unknown[]; appendChild(node: unknown): void } | null;
  ownerDocument: { createElement(tag: string): any };
  getBoundingClientRect(): { width: number; height: number };
  setAttribute(name: string, value: string): void;
  __keyconBackdrop?: string;
};

function stretchContent(el: Host) {
  const root = el.shadowRoot;
  if (!root || (root as { __keycon?: boolean }).__keycon) return;
  (root as { __keycon?: boolean }).__keycon = true;
  const Sheet = (globalThis as { CSSStyleSheet?: new () => { replaceSync(css: string): void } }).CSSStyleSheet;
  if (Sheet && Array.isArray(root.adoptedStyleSheets)) {
    const sheet = new Sheet();
    sheet.replaceSync(CONTENT_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else {
    const tag = el.ownerDocument.createElement('style');
    tag.textContent = CONTENT_CSS;
    root.appendChild(tag);
  }
}

// ---- a aurora lisa (a mesma conta do shader do celular, sem as linhas) ----
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * fx;
  const b = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}
function fbm(x: number, y: number) {
  let value = 0;
  let amplitude = 0.5;
  for (let i = 0; i < 4; i++) {
    value += amplitude * noise(x, y);
    x = x * 2.03 + 11.7;
    y = y * 2.03 + 11.7;
    amplitude *= 0.5;
  }
  return value;
}

function auroraColor(px: number, py: number, w: number, h: number, a: GlassAurora): Rgb {
  const m = Math.max(w, h);
  const qx = (px / m) * 2.4;
  const qy = (py / m) * 2.4;
  const t = a.time * 0.045;
  const wx = fbm(qx + t, qy - t * 0.7);
  const wy = fbm(qx - t * 0.6 + 5.2, qy + t + 5.2);
  const x = qx + wx * 1.35;
  const y = qy + wy * 1.35;
  const ax = Math.max(w / h, 1) * 1.2;
  const ay = Math.max(h / w, 1) * 1.2;
  let c: Rgb = [...a.base] as Rgb;
  a.spots.forEach((tint, i) => {
    const cx = (0.6 + 1.1 * Math.sin(t * (1 + i * 0.37) + i * 1.9)) * ax;
    const cy = (0.55 + 0.75 * Math.cos(t * (0.8 + i * 0.29) + i * 2.6)) * ay;
    const reach = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * 1.15);
    const k = Math.min(Math.max(reach * 1.25, 0), 1);
    c = [c[0] + (tint[0] - c[0]) * k, c[1] + (tint[1] - c[1]) * k, c[2] + (tint[2] - c[2]) * k];
  });
  return c;
}

/** Imagem da aurora (PNG em data URL), em baixa resolução: ela é lisa, ampliar não aparece. */
function auroraImage(el: Host, a: GlassAurora, w: number, h: number): string {
  const scale = Math.min(1, 220 / Math.max(w, h));
  const iw = Math.max(8, Math.round(w * scale));
  const ih = Math.max(8, Math.round(h * scale));
  const canvas = el.ownerDocument.createElement('canvas');
  canvas.width = iw;
  canvas.height = ih;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(iw, ih);
  for (let j = 0; j < ih; j++) {
    for (let i = 0; i < iw; i++) {
      const c = auroraColor(((i + 0.5) / iw) * w, ((j + 0.5) / ih) * h, w, h, a);
      const o = (j * iw + i) * 4;
      img.data[o] = Math.round(Math.min(1, c[0]) * 255);
      img.data[o + 1] = Math.round(Math.min(1, c[1]) * 255);
      img.data[o + 2] = Math.round(Math.min(1, c[2]) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function paintBackdrop(el: Host, a: GlassAurora, attempt = 0) {
  const { width, height } = el.getBoundingClientRect();
  if (width < 1 || height < 1) {
    if (attempt < 20) requestAnimationFrame(() => paintBackdrop(el, a, attempt + 1));
    return;
  }
  const key = `${Math.round(width)}x${Math.round(height)}|${a.css}`;
  if (el.__keyconBackdrop === key) return;
  el.__keyconBackdrop = key;
  el.setAttribute('backdrop', auroraImage(el, a, width, height));
}

export function GlassScene({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const colors = useColors();
  const aurora = glassAurora(colors);
  const auroraKey = aurora.css;
  const attach = useCallback(
    (node: unknown) => {
      if (!node) return;
      const el = node as Host;
      stretchContent(el);
      paintBackdrop(el, glassAurora(colors));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auroraKey],
  );

  if (!colors.glass) {
    return (
      <View style={style}>
        <Aurora />
        {children}
      </View>
    );
  }
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  return createElement(
    'liquid-glass',
    {
      ref: attach,
      // Parado: sem o vidro seguindo o cursor. As peças continuam acompanhando o
      // layout, então a bolha da barra desliza normalmente.
      'reduce-motion': '',
      dim: String(aurora.dim),
      style: {
        // O conteúdo segue o layout do React Native (flex em coluna)
        display: 'flex',
        flexDirection: 'column',
        flex: flat.flex ?? 1,
        minHeight: 0,
        background: colors.canvas,
        color: 'inherit',
      },
    },
    children,
  );
}
