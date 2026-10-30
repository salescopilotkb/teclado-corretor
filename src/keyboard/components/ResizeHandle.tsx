/**
 * Barrinha no topo de algumas abas para puxar o teclado.
 *
 * Dois jeitos:
 *  - "gaveta" (Agenda, CRM): a aba abre sempre na altura máxima. Arrastar para
 *    baixo leva o conteúdo junto (só uma animação, sem redimensionar a janela a
 *    cada movimento) e, ao soltar, volta ao teclado de letras com um leve bounce;
 *    soltar antes do ponto volta a aba ao lugar;
 *  - "livre" (Arquivos, Configurações): o teclado fica da altura em que a pessoa
 *    soltar (guardada por aba enquanto o teclado está aberto). Abaixo do teclado
 *    normal não diminui mais: volta ao teclado de letras.
 *
 * Telas sem barrinha (formulários) voltam ao tamanho que elas pedem.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { t } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { makeStyles } from '../theme';

/** Altura atual do teclado (medida no layout) e os limites, em dp. */
export interface KeyboardSize {
  height: number;
  normal: number;
  max: number;
}

/**
 * O CorretorKeyboard mantém `current` atualizado (o mesmo objeto: a barrinha lê na
 * hora do toque) e aplica `offset` (deslocamento para baixo) na área das abas.
 */
export interface KeyboardSizeState {
  current: KeyboardSize;
  offset: Animated.Value;
}

export const KeyboardSizeContext = createContext<KeyboardSizeState>({
  current: { height: 350, normal: 350, max: 700 },
  offset: new Animated.Value(0),
});

/** Altura escolhida em cada aba "livre" (some quando o processo do teclado reinicia). */
const chosen = new Map<string, number>();

/** Livre: puxou este tanto abaixo do teclado normal, volta ao teclado de letras. */
const COLLAPSE_DP = 28;
/** Gaveta: arrastou para baixo pelo menos isto (dp), fecha ao soltar. */
const DRAWER_CLOSE_DP = 48;
/** Livre: no máximo uma mudança de altura a cada tanto (a janela do teclado é cara de redesenhar). */
const RESIZE_EVERY_MS = 40;

type Mode = 'drawer' | 'free';

export function ResizeHandle({ id, onCollapse, mode = 'free' }: { id: string; onCollapse: () => void; mode?: Mode }) {
  const styles = useStyles();
  const size = useContext(KeyboardSizeContext);
  const collapseRef = useRef(onCollapse);
  collapseRef.current = onCollapse;

  // Livre: aparece na altura escolhida nesta aba (também ao reabrir o teclado, que
  // volta ao normal); ao sair da tela, o teclado volta ao tamanho que a seguinte pedir.
  // Gaveta: sempre a altura máxima (a do modo expandido da aba)
  useEffect(() => {
    if (mode === 'drawer') {
      KeyboardBridge.setKeyboardHeight(0).catch(() => {});
      return;
    }
    const apply = () => {
      const h = chosen.get(id);
      if (h) KeyboardBridge.setKeyboardHeight(h).catch(() => {});
    };
    apply();
    const off = KeyboardBridge.onKeyboardShow(() => setTimeout(apply, 0));
    return () => {
      off();
      KeyboardBridge.setKeyboardHeight(0).catch(() => {});
    };
  }, [id, mode]);

  const responder = useMemo(() => {
    let grabY = 0;
    let startHeight = 0;
    let last = 0;
    let lastAt = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let collapsed = false;

    const resize = (h: number, now = false) => {
      last = h;
      const send = () => {
        pending = null;
        lastAt = Date.now();
        KeyboardBridge.setKeyboardHeight(last).catch(() => {});
      };
      if (pending) clearTimeout(pending);
      const wait = RESIZE_EVERY_MS - (Date.now() - lastAt);
      if (now || wait <= 0) send();
      else pending = setTimeout(send, wait);
    };

    /**
     * Livre. No celular o toque é medido a partir do topo do teclado, que sobe junto
     * com o dedo: a distância do dedo à base (altura − y) não muda enquanto ele cresce.
     * Na web o toque vem na página inteira: vale a distância percorrida.
     */
    const wanted = (e: GestureResponderEvent) => {
      const y = e.nativeEvent.pageY;
      return Platform.OS === 'web' ? startHeight - (y - grabY) : size.current.height - y + grabY;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        grabY = e.nativeEvent.pageY;
        startHeight = size.current.height;
        last = startHeight;
        collapsed = false;
      },
      onPanResponderMove: (e, g) => {
        if (mode === 'drawer') {
          // O conteúdo acompanha o dedo para baixo; para cima, só um pouco (já está no máximo)
          size.offset.setValue(g.dy > 0 ? g.dy * 0.6 : g.dy * 0.12);
          return;
        }
        if (collapsed) return;
        const { normal, max } = size.current;
        const h = wanted(e);
        if (h < normal - COLLAPSE_DP) {
          // Passou da altura mínima: não diminui mais, volta ao teclado de letras
          collapsed = true;
          if (pending) clearTimeout(pending);
          chosen.delete(id);
          collapseRef.current();
          return;
        }
        const next = Math.round(Math.min(Math.max(h, normal), max));
        if (Math.abs(next - last) >= 2) resize(next);
      },
      onPanResponderRelease: (_e, g) => {
        if (mode === 'drawer') {
          if (g.dy > DRAWER_CLOSE_DP || g.vy > 1.2) {
            // Desce o resto e volta ao teclado de letras (o bounce é do CorretorKeyboard)
            Animated.timing(size.offset, { toValue: 90, duration: 110, useNativeDriver: true }).start(() => collapseRef.current());
          } else {
            Animated.spring(size.offset, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }).start();
          }
          return;
        }
        if (collapsed) return;
        resize(last, true);
        chosen.set(id, last);
      },
      onPanResponderTerminate: () => {
        if (mode === 'drawer') Animated.spring(size.offset, { toValue: 0, useNativeDriver: true }).start();
      },
    });
  }, [id, mode, size]);

  return (
    <View
      {...responder.panHandlers}
      style={styles.area}
      testID={`resize-${id}`}
      accessibilityRole="adjustable"
      accessibilityLabel={mode === 'drawer' ? t('Arraste para baixo para voltar ao teclado') : t('Arraste para mudar a altura do teclado')}
      hitSlop={{ top: 8, bottom: 6 }}>
      <View style={styles.pill} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  area: { height: 20, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.6 },
}));
