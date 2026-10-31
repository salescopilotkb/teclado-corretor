import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Palette } from '../theme';
import { makeStyles, radius, useColors } from '../theme';

/**
 * Sistema de ícones do KEYCON: traço único de 2 px, cantos e pontas
 * arredondados, grade 24 × 24. Configurações usa engrenagem (não sol).
 *
 * Os desenhos seguem a referência do manual. Quando o pacote oficial (ZIP com
 * os SVG) estiver no projeto, basta trocar os caminhos abaixo.
 */

type Shape =
  | { d: string; fill?: boolean }
  | { circle: [cx: number, cy: number, r: number]; fill?: boolean }
  | { rect: [x: number, y: number, w: number, h: number, rx: number]; fill?: boolean };

const ICONS = {
  // ── Conjunto do manual ──────────────────────────────────────────────
  clientes: [
    { circle: [9, 7, 4] },
    { d: 'M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1' },
    { d: 'M16 3.3a4 4 0 0 1 0 7.4' },
    { d: 'M19 14.3a6 6 0 0 1 3 5.2V21' },
  ],
  respostas: [
    { d: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { d: 'M8 8h8M8 12h5' },
  ],
  arquivos: [
    { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
    { d: 'M14 2v6h6' },
    { d: 'M8 13h8M8 17h8' },
  ],
  ia: [{ d: 'M12 2.5Q13.6 10.4 21.5 12 13.6 13.6 12 21.5 10.4 13.6 2.5 12 10.4 10.4 12 2.5z' }],
  calendario: [
    { rect: [3, 4.5, 18, 17, 2.5] },
    { d: 'M8 2.5v4M16 2.5v4M3 10h18' },
    { d: 'M7.5 14h3M13.5 14h3M7.5 17.5h3' },
  ],
  configuracoes: [
    {
      d:
        'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38' +
        'a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38' +
        'a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18' +
        'a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08' +
        'a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08' +
        'a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    },
    { circle: [12, 12, 3] },
  ],
  atalhos: [{ d: 'M13 2 4 14h7l-1 8 9-12h-7z' }],
  favoritos: [{ d: 'M6 3h12v18l-6-5-6 5z' }],
  notas: [{ rect: [5, 3, 14, 18, 2.5] }, { d: 'M9 8h6M9 12h6M9 16h4' }],
  etiquetas: [
    { d: 'M3 4v7.2a2 2 0 0 0 .6 1.4l8.3 8.3a2 2 0 0 0 2.8 0l6.4-6.4a2 2 0 0 0 0-2.8L12.8 3.4A2 2 0 0 0 11.4 3H4a1 1 0 0 0-1 1z' },
    { circle: [8, 8, 1.6], fill: true },
  ],
  estatisticas: [{ rect: [4, 13, 4, 8, 2] }, { rect: [10, 8, 4, 13, 2] }, { rect: [16, 3, 4, 18, 2] }],
  mais: [{ circle: [5, 12, 1.5] }, { circle: [12, 12, 1.5] }, { circle: [19, 12, 1.5] }],
  novaPasta: [
    { d: 'M2 6a2 2 0 0 1 2-2h5l2 2.5h9a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z' },
    { d: 'M12 10.5v6M9 13.5h6' },
  ],
  // Tradução: "A" e "文" (os dois idiomas)
  traduzir: [
    { d: 'M3 5h8M7 3v2M4.5 9c1.6 2.8 3.6 4.4 6 5' },
    { d: 'M9.5 5c-.6 3.8-2.6 7-6 9' },
    { d: 'M13 21l4-9 4 9M14.5 18h5' },
  ],
  // Seção Arquivos: fotos empilhadas, editar, excluir e mover para outra pasta
  galeria: [{ rect: [7, 3, 14, 14, 2.5] }, { circle: [11.5, 7.5, 1.5] }, { d: 'M21 13l-4-4-7 7' }, { d: 'M3 7v12a2 2 0 0 0 2 2h12' }],
  editar: [{ d: 'M4 20h4L19 9l-4-4L4 16z' }, { d: 'M13.5 6.5l4 4' }],
  lixeira: [{ d: 'M4 7h16M9 7V4.5h6V7' }, { d: 'M6 7l1 13h10l1-13' }, { d: 'M10 11v5.5M14 11v5.5' }],
  mover: [
    { d: 'M2 6a2 2 0 0 1 2-2h5l2 2.5h9a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z' },
    { d: 'M8.5 13.5h7M13 11l2.5 2.5L13 16' },
  ],
  compartilhar: [
    { circle: [18, 5, 3] },
    { circle: [6, 12, 3] },
    { circle: [18, 19, 3] },
    { d: 'M8.6 13.5l6.8 4M15.4 6.5l-6.8 4' },
  ],
  busca: [{ circle: [11, 11, 7.5] }, { d: 'M21 21l-4.5-4.5' }],
  dados: [{ rect: [3, 3, 18, 18, 2.5] }, { d: 'M3 9h18M9 21V9M13 13h4M13 17h4' }],

  // ── Apoio (mesmo traço) ─────────────────────────────────────────────
  pasta: [{ d: 'M2 6a2 2 0 0 1 2-2h5l2 2.5h9a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z' }],
  teclado: [{ rect: [2, 5, 20, 14, 2.5] }, { d: 'M6 9.5h1M10 9.5h1M14 9.5h1M17 9.5h1M8 14.5h8' }],
  audio: [
    { rect: [9, 2, 6, 12, 3] },
    { d: 'M19 10v1a7 7 0 0 1-14 0v-1M12 18v4' },
  ],
  foto: [{ rect: [3, 3, 18, 18, 2.5] }, { circle: [9, 9, 2] }, { d: 'M21 15l-5-5L5 21' }],
  video: [{ rect: [2, 6, 14, 12, 2.5] }, { d: 'M16 10.5l6-3.5v10l-6-3.5' }],
  voltar: [{ d: 'M15 18l-6-6 6-6' }],
  avancar: [{ d: 'M9 18l6-6-6-6' }],
  check: [{ d: 'M20 6 9 17l-5-5' }],
  fechar: [{ d: 'M18 6 6 18M6 6l12 12' }],
  adicionar: [{ d: 'M12 5v14M5 12h14' }],
  sair: [{ d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' }],
  info: [{ circle: [12, 12, 10] }, { d: 'M12 16v-4M12 8h.01' }],
  shift: [{ d: 'M9 20v-7H4.5L12 4.5l7.5 8.5H15v7z' }],
  capsLock: [{ d: 'M9 20v-7H4.5L12 4.5l7.5 8.5H15v7z', fill: true }],
  apagar: [
    { d: 'M9.5 5a2 2 0 0 0-1.4.6l-5.4 5.7a1 1 0 0 0 0 1.4l5.4 5.7a2 2 0 0 0 1.4.6H20a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z' },
    { d: 'M12 9l6 6M18 9l-6 6' },
  ],
  globo: [{ circle: [12, 12, 10] }, { d: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20' }],
  enter: [{ d: 'M9 10l-5 5 5 5' }, { d: 'M20 4v7a4 4 0 0 1-4 4H4' }],
  // Tecla de emojis: rosto só no traço, como os outros ícones (não o emoji colorido)
  emoji: [{ circle: [12, 12, 9.5] }, { d: 'M8.5 14.5a4.5 4.5 0 0 0 7 0' }, { d: 'M9 9.5h.01M15 9.5h.01' }],

  // ── Ramos de negócio (cadastro) ─────────────────────────────────────
  casa: [{ d: 'M3 10.5 12 3l9 7.5' }, { d: 'M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9' }, { d: 'M10 21v-6h4v6' }],
  escudo: [{ d: 'M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z' }, { d: 'M8.5 12l2.5 2.5 4.5-5' }],
  talheres: [{ d: 'M5 2v6a2 2 0 0 0 4 0V2M7 2v20' }, { d: 'M18 22V2c-2.2 1.4-3.5 4-3.5 7.5 0 2.2 1.2 3.3 3.5 3.8' }],
  balanca: [
    { d: 'M12 3v18M8 21h8M5 7h14' },
    { d: 'M2.5 13 5 7l2.5 6a2.5 2.5 0 0 1-5 0z' },
    { d: 'M16.5 13 19 7l2.5 6a2.5 2.5 0 0 1-5 0z' },
  ],
  sacola: [{ d: 'M5.5 7h13l1 13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z' }, { d: 'M9 10V6a3 3 0 0 1 6 0v4' }],
  tesoura: [{ circle: [6, 6, 3] }, { circle: [6, 18, 3] }, { d: 'M8.6 7.6 20 19M8.6 16.4 20 5' }],
  carro: [
    { d: 'M5 11l1.6-4.3A2 2 0 0 1 8.5 5.4h7a2 2 0 0 1 1.9 1.3L19 11' },
    { rect: [3, 11, 18, 6, 2] },
    { d: 'M6.5 17v2M17.5 17v2' },
    { circle: [7, 14, 0.8], fill: true },
    { circle: [17, 14, 0.8], fill: true },
  ],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

/** Ícone de cada tipo de arquivo do Locker (foto mostra a própria imagem). */
export function fileIcon(type: 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'other'): IconName {
  return type === 'image' ? 'foto' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'arquivos';
}

/** Cores funcionais do manual (coral = ação, verde = arquivos, roxo = IA, azul = etiquetas). */
export function iconColor(name: IconName, colors: Palette): string {
  switch (name) {
    case 'respostas':
    case 'calendario':
    case 'atalhos':
    case 'favoritos':
      return colors.primary;
    case 'arquivos':
      return colors.teal;
    case 'ia':
      return '#8A5CF6';
    case 'etiquetas':
      return colors.blue;
    case 'configuracoes':
    case 'busca':
      return colors.iconMuted;
    default:
      return colors.iconNeutral;
  }
}

interface IconProps {
  name: IconName;
  size?: number;
  /** Sem cor, usa a cor funcional do ícone. */
  color?: string;
  strokeWidth?: number;
}

export const Icon = memo(({ name, size = 22, color, strokeWidth = 2 }: IconProps) => {
  const colors = useColors();
  const stroke = color ?? iconColor(name, colors);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(ICONS[name] as Shape[]).map((shape, i) => {
        const paint = {
          stroke,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: shape.fill ? stroke : 'none',
        };
        if ('circle' in shape) {
          const [cx, cy, r] = shape.circle;
          return <Circle key={i} cx={cx} cy={cy} r={r} {...paint} />;
        }
        if ('rect' in shape) {
          const [x, y, width, height, rx] = shape.rect;
          return <Rect key={i} x={x} y={y} width={width} height={height} rx={rx} {...paint} />;
        }
        return <Path key={i} d={shape.d} {...paint} />;
      })}
    </Svg>
  );
});

/** Ícone dentro do "tile" cinza-claro do manual (IA usa fundo lilás). */
export const IconTile = memo(({ name, size = 40, color }: { name: IconName; size?: number; color?: string }) => {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: name === 'ia' ? colors.tileAi : colors.tile },
      ]}>
      <Icon name={name} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
});

const useStyles = makeStyles(() => ({
  tile: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
