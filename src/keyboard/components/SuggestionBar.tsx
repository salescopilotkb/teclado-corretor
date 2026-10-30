import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, processColor, Text, View } from 'react-native';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { makeStyles, useColors } from '../theme';

/**
 * Barra de sugestões acima das teclas (como no iPhone e no Gboard):
 * a palavra digitada "entre aspas" quando ela não existe no dicionário,
 * a melhor sugestão em destaque e mais uma ou duas opções.
 *
 * O estado mora aqui dentro: a cada letra só esta barra se redesenha,
 * não o teclado inteiro.
 */

export interface SuggestionItem {
  text: string;
  /** true = manter o que foi digitado (só adiciona o espaço). */
  literal: boolean;
  /** A digitada está certa (dicionário ou palavra aprendida): aparece sem aspas. */
  correct?: boolean;
  /** A que fica em destaque (a que entra com o espaço). */
  best?: boolean;
}

export interface SuggestionBarHandle {
  show(items: SuggestionItem[]): void;
}

interface Props {
  onPick: (item: SuggestionItem) => void;
  /** Teclado digitando no app (não num formulário do KEYCON): mostra ali o preenchimento automático. */
  autofill?: boolean;
}

/** Na web o Pressable espera 50 ms antes do toque; aqui não precisa. */
const WEB_NO_PRESS_DELAY = Platform.OS === 'web' ? ({ delayPressIn: 0 } as object) : {};

export const SuggestionBar = memo(
  forwardRef<SuggestionBarHandle, Props>(({ onPick, autofill = false }, ref) => {
    const colors = useColors();
    const styles = useStyles();
    const [items, setItems] = useState<SuggestionItem[]>([]);

    useImperativeHandle(ref, () => ({ show: setItems }), []);

    // Preenchimento automático do Android (e-mails, endereços): as sugestões aparecem
    // por cima desta faixa, como no Gboard, e não numa caixinha sobre a tela
    const barRef = useRef<View>(null);
    const reportArea = useCallback(() => {
      if (!autofill) return;
      const color = processColor(colors.bg);
      barRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        KeyboardBridge.setAutofillArea({ x: pageX, y: pageY, width, height, color: typeof color === 'number' ? color : 0 });
      });
    }, [autofill, colors.bg]);
    useEffect(() => {
      reportArea();
    }, [reportArea]);
    useEffect(() => {
      if (!autofill) return;
      return () => KeyboardBridge.setAutofillArea(null);
    }, [autofill]);

    // Em destaque: a marcada (a que entra com o espaço) ou a primeira sugestão de verdade
    const marked = items.findIndex(i => i.best);
    const highlighted = marked >= 0 ? marked : items.findIndex(i => !i.literal);

    return (
      <View ref={barRef} style={styles.bar} testID="suggestion-bar" onLayout={reportArea}>
        {items.map((item, i) => (
          <React.Fragment key={`${i}-${item.text}`}>
            {i > 0 && <View style={styles.divider} />}
            <Pressable
              {...WEB_NO_PRESS_DELAY}
              testID={`suggestion-${i}`}
              accessibilityRole="button"
              onPress={() => onPick(item)}
              android_ripple={{ color: colors.surfaceActive }}
              style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}>
              <Text
                numberOfLines={1}
                style={[styles.text, i === highlighted && styles.textBest, item.literal && !item.correct && styles.textLiteral]}>
                {item.literal && !item.correct ? `“${item.text}”` : item.text}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    );
  }),
);

const useStyles = makeStyles(colors => ({
  bar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.bg,
  },
  cell: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cellPressed: {
    backgroundColor: colors.surfaceActive,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.divider,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '400',
  },
  textBest: {
    color: colors.text,
    fontWeight: '600',
  },
  textLiteral: {
    color: colors.textMuted,
  },
}));
