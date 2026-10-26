import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { t } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { MainSystemTab, MenuTab } from '../../types';
import { makeStyles, radius, touchTarget, useColors } from '../theme';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { KeyconLogo } from './KeyconLogo';

const BUTTONS: Record<MenuTab, { label: string; icon: IconName }> = {
  files: { label: 'Arquivos', icon: 'galeria' },
  products: { label: 'Produtos', icon: 'arquivos' },
  shortcuts: { label: 'Atalhos', icon: 'atalhos' },
  agenda: { label: 'Agenda', icon: 'calendario' },
  crm: { label: 'CRM', icon: 'clientes' },
  more: { label: 'Mais', icon: 'mais' },
};

/** Segurar este tempo num botão: o teclado vibra e o botão descola para ser arrastado. */
const DRAG_HOLD_MS = 1000;
/** Espaço da barra nas pontas (paddingHorizontal de styles.bar). */
const BAR_PADDING = 6;
/** Mexeu o dedo mais que isso antes de segurar: não é toque nem arrasto. */
const TAP_SLOP = 12;

interface Props {
  active: MainSystemTab;
  onChange: (tab: MainSystemTab) => void;
  /** Ordem dos botões escolhida pelo usuário. */
  order: MenuTab[];
  /** Soltou um botão arrastado: a nova ordem (para salvar). */
  onReorder: (order: MenuTab[]) => void;
  /** Nome do catálogo no ramo do usuário ("Imóveis", "Cardápio"...). */
  catalogLabel?: string;
}

/**
 * Menu do teclado, SEMPRE VISÍVEL no topo:
 *  - em cima, o logotipo KEYCON (à esquerda) e o ícone de teclado (à direita,
 *    fixo), que alterna entre o teclado de letras e a última seção usada;
 *  - embaixo, os botões das seções (Arquivos, Produtos, Atalhos, Agenda, CRM,
 *    Mais), com ícone e texto em cinza como no app; o ativo fica coral.
 *
 * Segurar um botão por 1 segundo: o teclado vibra, o botão descola do fundo
 * e acompanha o dedo; soltar em outra posição muda a ordem (fica salva).
 */
export const SystemMenuBar = memo(({ active, onChange, order, onReorder, catalogLabel }: Props) => {
  const colors = useColors();
  const styles = useStyles();
  const keyboardActive = active === 'keyboard';

  // Ordem na tela: acompanha o dedo enquanto arrasta; salva ao soltar
  const [items, setItems] = useState<MenuTab[]>(order);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => setItems(order), [order]);

  const [dragging, setDragging] = useState<MenuTab | null>(null);
  const draggingRef = useRef<MenuTab | null>(null);
  /** Quanto o botão arrastado está fora do lugar dele (acompanha o dedo). */
  const [dragX, setDragX] = useState(0);
  /** Botão sob o dedo (para o efeito de toque). */
  const [pressedKey, setPressedKey] = useState<MenuTab | null>(null);
  const gesture = useRef<{ key: MenuTab; x0: number; lastX: number; moved: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(
    null,
  );
  const barRef = useRef<View>(null);
  const bar = useRef({ x: 0, width: 0 });

  const measureBar = useCallback((e?: LayoutChangeEvent) => {
    if (e) bar.current.width = e.nativeEvent.layout.width;
    barRef.current?.measure((_x, _y, width, _h, pageX) => {
      if (typeof pageX === 'number') bar.current = { x: pageX, width: width || bar.current.width };
    });
  }, []);

  /** Botão na posição x da tela. */
  const keyAt = (pageX: number): MenuTab | null => {
    const { x, width } = bar.current;
    const list = itemsRef.current;
    if (!width || !list.length) return null;
    return list[Math.max(0, Math.min(list.length - 1, Math.floor(((pageX - x) / width) * list.length)))];
  };

  /** Centro do lugar `index` na tela (os botões dividem a barra igualmente). */
  const slotCenter = (index: number) => {
    const { x, width } = bar.current;
    const slot = (width - BAR_PADDING * 2) / itemsRef.current.length;
    return x + BAR_PADDING + slot * (index + 0.5);
  };

  const endGesture = () => {
    const g = gesture.current;
    if (g?.timer) clearTimeout(g.timer);
    gesture.current = null;
    setPressedKey(null);
    if (draggingRef.current) {
      draggingRef.current = null;
      setDragging(null);
      setDragX(0);
      const next = itemsRef.current;
      if (next.join() !== order.join()) onReorder(next);
    }
  };

  // A barra recebe o gesto inteiro (como o teclado de letras): um toque abre a
  // seção; segurar e arrastar muda a ordem. Funciona com o dedo e com o mouse.
  const responder = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => !draggingRef.current,
    onResponderGrant: (e: GestureResponderEvent) => {
      measureBar();
      const pageX = e.nativeEvent.pageX;
      const key = keyAt(pageX);
      if (!key) return;
      setPressedKey(key);
      const g = { key, x0: pageX, lastX: pageX, moved: false, timer: null as ReturnType<typeof setTimeout> | null };
      g.timer = setTimeout(() => {
        g.timer = null;
        if (g.moved) return;
        // Segurou 1 s: vibra e o botão descola, já embaixo do dedo
        KeyboardBridge.hapticLongPress();
        draggingRef.current = key;
        setDragging(key);
        setPressedKey(null);
        setDragX(g.lastX - slotCenter(itemsRef.current.indexOf(key)));
      }, DRAG_HOLD_MS);
      gesture.current = g;
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (!g) return;
      const pageX = e.nativeEvent.pageX;
      g.lastX = pageX;
      const key = draggingRef.current;
      if (!key) {
        // Mexeu antes de segurar: desiste (nem toque nem arrasto)
        if (Math.abs(pageX - g.x0) > TAP_SLOP) {
          g.moved = true;
          setPressedKey(null);
        }
        return;
      }
      // O botão arrastado vai para a posição sob o dedo; os outros abrem espaço
      const target = keyAt(pageX);
      const list = itemsRef.current;
      if (target && target !== key) {
        const next = list.filter(k => k !== key);
        next.splice(list.indexOf(target), 0, key);
        itemsRef.current = next;
        setItems(next);
      }
      // ...e continua grudado no dedo (deslocado do centro do lugar novo)
      setDragX(pageX - slotCenter(itemsRef.current.indexOf(key)));
    },
    onResponderRelease: () => {
      const g = gesture.current;
      const tapped = g && !g.moved && !draggingRef.current && g.timer ? g.key : null;
      endGesture();
      if (tapped) onChange(tapped);
    },
    onResponderTerminate: endGesture,
  };

  return (
    <View style={styles.wrap} testID="system-menu-bar">
      <View style={styles.head}>
        {dragging ? (
          <Text style={styles.dragHint} numberOfLines={1}>
            {t('Arraste para mudar a ordem')}
          </Text>
        ) : (
          <KeyconLogo size={16} />
        )}
        <Pressable
          testID="system-btn-keyboard"
          accessibilityRole="tab"
          accessibilityLabel={t('Teclado')}
          accessibilityState={{ selected: keyboardActive }}
          hitSlop={6}
          onPress={() => onChange('keyboard')}
          style={({ pressed }) => [styles.keyboardBtn, pressed && styles.pressed]}>
          <Icon name="teclado" size={22} color={keyboardActive ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      <View ref={barRef} style={styles.bar} onLayout={measureBar} {...responder}>
        {items.map(key => {
          const btn = BUTTONS[key];
          const selected = key === active;
          const lifted = key === dragging;
          const label = key === 'products' && catalogLabel ? catalogLabel : t(btn.label);
          return (
            <View
              key={key}
              testID={`system-btn-${key}`}
              accessible
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityHint={t('Segure e arraste para mudar a ordem')}
              accessibilityState={{ selected }}
              // Leitor de tela: tocar duas vezes abre a seção
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => onChange(key)}
              style={[
                styles.tab,
                lifted && styles.tabLifted,
                lifted && { transform: [{ translateX: dragX }, { translateY: -4 }, { scale: 1.12 }] },
                pressedKey === key && !dragging && styles.pressed,
                !!dragging && !lifted && styles.tabWaiting,
              ]}>
              {/* Igual ao menu do app: cinza; o item ativo fica coral */}
              <Icon name={btn.icon} size={20} color={selected || lifted ? colors.primary : colors.textMuted} />
              <Text style={[styles.label, (selected || lifted) && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const useStyles = makeStyles(colors => ({
  wrap: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 6,
    paddingTop: 2,
  },
  dragHint: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.primaryText },
  keyboardBtn: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingBottom: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  /** Botão "descolado": mais alto, com sombra, por cima dos outros e seguindo o dedo. */
  tabLifted: {
    zIndex: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  /** Os outros botões ficam mais apagados enquanto um é arrastado. */
  tabWaiting: { opacity: 0.6 },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
}));
