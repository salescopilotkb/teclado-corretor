/**
 * Barrinha no topo de algumas abas (Arquivos, CRM, Configurações): a pessoa
 * puxa para cima ou para baixo e o teclado fica da altura em que ela soltar.
 * Abaixo da altura do teclado normal ele não diminui mais: volta ao teclado
 * de letras.
 *
 * Enquanto a barrinha está na tela, vale a altura escolhida (guardada por aba
 * enquanto o teclado está aberto no aparelho). Telas sem barrinha (formulários)
 * voltam ao tamanho que elas pedem.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, View } from 'react-native';
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

/** O CorretorKeyboard mantém o objeto atualizado (mesmo objeto: a barrinha lê na hora do toque). */
export const KeyboardSizeContext = createContext<{ current: KeyboardSize }>({ current: { height: 350, normal: 350, max: 700 } });

/** Altura escolhida em cada aba (some quando o processo do teclado reinicia). */
const chosen = new Map<string, number>();

/** Puxou este tanto abaixo do teclado normal: volta ao teclado de letras. */
const COLLAPSE_DP = 28;

export function ResizeHandle({ id, onCollapse }: { id: string; onCollapse: () => void }) {
  const styles = useStyles();
  const size = useContext(KeyboardSizeContext);
  const collapseRef = useRef(onCollapse);
  collapseRef.current = onCollapse;

  // Aparece: volta à altura escolhida nesta aba (também ao reabrir o teclado, que volta ao normal).
  // Sai da tela: o teclado volta ao tamanho que a tela seguinte pedir.
  useEffect(() => {
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
  }, [id]);

  const responder = useMemo(() => {
    let grabY = 0;
    let startHeight = 0;
    let last = 0;
    let collapsed = false;
    /**
     * No celular o toque é medido a partir do topo do teclado, que sobe junto com
     * o dedo: a distância do dedo à base (altura − y) não muda enquanto ele cresce.
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
      onPanResponderMove: e => {
        if (collapsed) return;
        const { normal, max } = size.current;
        const h = wanted(e);
        if (h < normal - COLLAPSE_DP) {
          // Passou da altura mínima: não diminui mais, volta ao teclado de letras
          collapsed = true;
          chosen.delete(id);
          collapseRef.current();
          return;
        }
        const next = Math.round(Math.min(Math.max(h, normal), max));
        if (Math.abs(next - last) < 2) return;
        last = next;
        KeyboardBridge.setKeyboardHeight(next).catch(() => {});
      },
      onPanResponderRelease: () => {
        if (!collapsed) chosen.set(id, last);
      },
    });
  }, [id, size]);

  return (
    <View
      {...responder.panHandlers}
      style={styles.area}
      testID={`resize-${id}`}
      accessibilityRole="adjustable"
      accessibilityLabel={t('Arraste para mudar a altura do teclado')}
      hitSlop={{ top: 6, bottom: 4 }}>
      <View style={styles.pill} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  area: { height: 18, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.6 },
}));
