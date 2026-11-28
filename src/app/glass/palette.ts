/**
 * Cores da aurora do liquid glass, a partir da paleta do app (as mesmas manchas da
 * Aurora em SVG: coral, pêssego, azul frio e névoa sobre o canvas). No tema escuro
 * cada mancha é misturada ao canvas, como a Aurora faz com a opacidade.
 */
import type { Palette } from '../../keyboard/theme';

export type Rgb = [number, number, number];

/** "#RRGGBB" → [r, g, b] de 0 a 1. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toHex = (c: Rgb) => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export interface GlassAurora {
  base: Rgb;
  spots: [Rgb, Rgb, Rgb, Rgb];
  /** As 4 cores em "#RRGGBB" (atributo colors do <liquid-glass> na web). */
  css: string;
  /** Linhas de contorno: dão "bordas" para o vidro entortar. */
  lines: number;
  dim: number;
  /** Fase fixa da aurora (o app não fica redesenhando): coral no meio, azul embaixo. */
  time: number;
}

export function glassAurora(colors: Palette): GlassAurora {
  const dark = colors.scheme === 'dark';
  const base = hexToRgb(colors.canvas);
  // Cores vivas e pouco escurecimento, para o vidro ter o que entortar. Sem as linhas
  // de contorno (a "textura de água"): o fundo é só a aurora lisa
  const spots = (
    [
      [colors.auroraCoral, 1],
      [colors.auroraPeach, 1],
      [colors.auroraDusk, 1],
      [colors.auroraMist, 1],
    ] as const
  ).map(([hex, k]) => mix(base, hexToRgb(hex), k)) as [Rgb, Rgb, Rgb, Rgb];
  return { base, spots, css: spots.map(toHex).join(' '), lines: 0, dim: dark ? 0.08 : 0, time: 30 };
}

/** Cor do vidro (rgb + força) a partir de uma cor CSS "#RRGGBB" ou nenhuma. */
export function glassTint(color: string | undefined, strength: number): [number, number, number, number] {
  if (!color || !color.startsWith('#')) return [1, 1, 1, 0];
  return [...hexToRgb(color), strength];
}
