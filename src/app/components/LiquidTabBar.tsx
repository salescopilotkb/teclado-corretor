/**
 * Barra de baixo em liquid glass: uma barra de vidro só, com os botões lado a lado
 * (sem quadrados nem espaços entre eles), e uma bolha de vidro atrás do item aberto
 * que escorre de um botão para o outro ao tocar.
 *
 * A animação "líquida": cada borda da bolha é uma mola. A borda da frente (no
 * sentido do movimento) é rápida e a de trás é lenta, então a bolha estica como uma
 * gota, achata um pouco enquanto estica e volta ao formato quando as duas chegam.
 * As molas são as do <liquid-glass> (stepSpring, MIT © zerowing).
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Icon } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { glassBorder, makeStyles, spacing } from '../../keyboard/theme';
import type { Palette } from '../../keyboard/theme';
import { GlassPane } from '../glass/GlassPane';
import type { Frame } from '../glass/GlassScene';

export interface TabBarItem {
  key: string;
  label: string;
  icon: IconName;
  tint: (colors: Palette) => string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

/** Barra em pílula (como a .tabbar da demo do liquid glass): raio = meia altura. */
export const TAB_BAR_RADIUS = 999;
/** Folga entre a borda da barra e os botões (o padding de 6px da demo). */
const BAR_PADDING = 6;
/** Altura de cada botão: a bolha ocupa o botão inteiro, com ~11pt de folga em volta do ícone e do nome. */
const SLOT_HEIGHT = 64;

interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Mola amortecida integrada em passos fixos (igual em qualquer taxa de quadros). */
function stepSpring(value: number, velocity: number, target: number, dt: number, stiffness: number, damping: number): [number, number] {
  const duration = Math.min(Math.max(dt, 0), 1 / 15);
  const steps = Math.max(1, Math.ceil(duration / (1 / 240)));
  const h = duration / steps;
  let p = value;
  let v = velocity;
  for (let i = 0; i < steps; i++) {
    v += ((target - p) * stiffness - v * damping) * h;
    p += v * h;
  }
  return [p, v];
}

/** Bordas esquerda e direita da bolha, animadas até o slot ativo. */
function useLiquidEdges(target: Slot | null) {
  const [edges, setEdges] = useState<{ left: number; right: number } | null>(null);
  const state = useRef({ l: 0, r: 0, vl: 0, vr: 0, ready: false });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const s = state.current;
    const goalL = target.x;
    const goalR = target.x + target.width;
    if (!s.ready) {
      // Primeira vez: a bolha já nasce no lugar
      Object.assign(s, { l: goalL, r: goalR, vl: 0, vr: 0, ready: true });
      setEdges({ left: goalL, right: goalR });
      return;
    }
    const movingRight = goalL > s.l;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 1 / 60 : (now - last) / 1000;
      last = now;
      // A borda da frente puxa (rápida) e a de trás escorre atrás (lenta)
      const fast = [520, 30] as const;
      const slow = [150, 19] as const;
      const [kl, dl] = movingRight ? slow : fast;
      const [kr, dr] = movingRight ? fast : slow;
      [s.l, s.vl] = stepSpring(s.l, s.vl, goalL, dt, kl, dl);
      [s.r, s.vr] = stepSpring(s.r, s.vr, goalR, dt, kr, dr);
      // Nunca vira do avesso
      if (s.r - s.l < 12) s.r = s.l + 12;
      const settled =
        Math.abs(s.l - goalL) < 0.3 && Math.abs(s.r - goalR) < 0.3 && Math.abs(s.vl) < 2 && Math.abs(s.vr) < 2;
      if (settled) Object.assign(s, { l: goalL, r: goalR, vl: 0, vr: 0 });
      setEdges({ left: s.l, right: s.r });
      frame.current = settled ? null : requestAnimationFrame(tick);
    };
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [target?.x, target?.width]); // eslint-disable-line react-hooks/exhaustive-deps

  return edges;
}

const LiquidBubble = memo(({ slot, origin }: { slot: Slot | null; origin: { x: number; y: number } | null }) => {
  const styles = useStyles();
  const edges = useLiquidEdges(slot);
  if (!slot || !edges) return null;
  const width = edges.right - edges.left;
  const restWidth = slot.width;
  // Esticada, a gota achata (até 22%)
  const stretch = Math.max(0, Math.min(1, (width - restWidth) / Math.max(restWidth, 1)));
  const fullHeight = slot.height;
  const height = fullHeight * (1 - 0.22 * stretch);
  const top = slot.y + (fullHeight - height) / 2;
  const radius = height / 2;
  const windowBox: Frame | null = origin ? { x: origin.x + edges.left, y: origin.y + top, width, height } : null;
  return (
    <GlassPane
      radius={radius}
      tint="#FFFFFF"
      tintStrength={0.16}
      depth={1.5}
      dome={1.6}
      chroma={0.014}
      shadow={0.45}
      pressed={stretch > 0.02}
      windowBox={windowBox}
      style={[styles.bubble, { left: edges.left, top, width, height }]}
      fallbackStyle={styles.bubbleFallback}
      sheenStrength={0.7}
    />
  );
});

export function LiquidTabBar({ items }: { items: TabBarItem[] }) {
  const styles = useStyles();
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const anchor = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const measureAnchor = useCallback(() => {
    anchor.current?.measureInWindow((x, y) => {
      setOrigin(o => (o && Math.abs(o.x - x) < 0.5 && Math.abs(o.y - y) < 0.5 ? o : { x, y }));
    });
  }, []);
  // A barra pode mudar de lugar na janela sem novo layout (ex.: o teclado do sistema)
  useEffect(() => {
    const id = setTimeout(measureAnchor, 150);
    return () => clearTimeout(id);
  }, [measureAnchor, items.length]);

  const onSlotLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setSlots(prev => {
      const old = prev[key];
      if (old && old.x === x && old.y === y && old.width === width && old.height === height) return prev;
      return { ...prev, [key]: { x, y, width, height } };
    });
  };

  const active = items.find(i => i.active);
  const activeSlot = active ? slots[active.key] ?? null : null;

  return (
    <GlassPane
      radius={TAB_BAR_RADIUS}
      tintStrength={0}
      depth={1.2}
      chroma={0.012}
      style={styles.bar}
      fallbackStyle={styles.barFallback}>
      {/* Canto de cima da barra na janela: o vidro da bolha precisa da posição exata */}
      <View ref={anchor} collapsable={false} pointerEvents="none" style={styles.anchor} onLayout={measureAnchor} />
      <LiquidBubble slot={activeSlot} origin={origin} />
      {items.map(item => {
        return (
          <Pressable
            key={item.key}
            testID={item.testID}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.active }}
            onLayout={onSlotLayout(item.key)}
            onPress={item.onPress}
            onLongPress={item.onLongPress}
            delayLongPress={400}
            style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}>
            {/* Símbolos sempre brancos (aberto ou não); o item aberto se destaca pela bolha e pelo nome */}
            <Icon name={item.icon} size={24} color="#FFFFFF" />
            <Text style={[styles.label, item.active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassPane>
  );
}

const useStyles = makeStyles(colors => ({
  bar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: BAR_PADDING,
    borderRadius: TAB_BAR_RADIUS,
  },
  /** Sem o vidro do Skia: fundo translúcido, borda e sombra. */
  barFallback: {
    backgroundColor: colors.glass ? colors.glassFillThin : colors.glassFillStrong,
    ...glassBorder(colors),
    shadowColor: '#000',
    shadowOpacity: colors.scheme === 'dark' ? 0.4 : 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  anchor: { position: 'absolute', left: 0, top: 0, width: 1, height: 1 },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: SLOT_HEIGHT,
    paddingHorizontal: 4,
  },
  slotPressed: { transform: [{ scale: 0.94 }] },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: colors.textSecondary },
  labelActive: { color: colors.primaryText, fontWeight: '700' },
  bubble: { position: 'absolute' },
  bubbleFallback: {
    backgroundColor: colors.glass ? colors.surfaceActive : colors.surfaceAlt,
    ...glassBorder(colors),
  },
}));
