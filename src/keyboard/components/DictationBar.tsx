/**
 * Ditado por voz (Android): faixa "Ouvindo…" acima das teclas. A pessoa fala e cada
 * frase entra no campo da conversa, com espaço antes e maiúscula no começo da frase.
 * Fica ouvindo até tocar em Parar (ou ficar em silêncio por um tempo).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getTypingLanguage, t } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { dictationError, VoiceTyping } from '../../native/VoiceTyping';
import { makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';

/** Junta a frase ao que já está no campo: espaço antes e maiúscula no começo da frase. */
function joinToField(before: string, text: string): string {
  const clean = text.trim();
  if (!clean) return '';
  const startsSentence = before.trim() === '' || /[.!?…]\s*$/.test(before);
  const cased = startsSentence ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
  const needsSpace = before !== '' && !/\s$/.test(before);
  return (needsSpace ? ' ' : '') + cased;
}

export function DictationBar({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const [state, setState] = useState<'starting' | 'listening' | 'error'>('starting');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let alive = true;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const fail = (message: string) => {
      if (!alive) return;
      setState('error');
      setError(message);
      closeTimer = setTimeout(() => closeRef.current(), 4000);
    };

    const off = VoiceTyping.onEvent(e => {
      if (!alive) return;
      if (e.type === 'listening') setState('listening');
      else if (e.type === 'partial') setPartial(e.text);
      else if (e.type === 'final') {
        setPartial('');
        KeyboardBridge.getInputContext()
          .then(ctx => {
            const piece = joinToField(ctx.before ?? '', e.text);
            if (piece) KeyboardBridge.insertText(piece).catch(() => {});
          })
          .catch(() => {});
      } else if (e.type === 'stopped') closeRef.current();
      else if (e.type === 'error') fail(dictationError(e.code));
    });

    (async () => {
      // O microfone: o mesmo pedido dos atalhos de áudio (abre por cima da conversa)
      const permission = await KeyboardBridge.requestMicPermission();
      if (!alive) return;
      if (permission !== 'granted') {
        fail(t('Permita o microfone para o KEYCON nas configurações do celular.'));
        return;
      }
      if (!(await VoiceTyping.isAvailable())) {
        fail(t('Este celular não tem o reconhecimento de voz do Android. Instale ou ative o app Google para usar o ditado.'));
        return;
      }
      VoiceTyping.start(getTypingLanguage()).catch(() => fail(dictationError(-1)));
    })().catch(() => fail(dictationError(-1)));

    return () => {
      alive = false;
      off();
      if (closeTimer) clearTimeout(closeTimer);
      VoiceTyping.stop();
    };
  }, []);

  const label =
    state === 'error' ? error : partial ? partial : state === 'listening' ? t('Ouvindo… pode falar') : t('Preparando o microfone…');

  return (
    <View style={styles.bar} testID="dictation-bar" accessibilityLiveRegion="polite">
      <Icon name="audio" size={18} color={state === 'error' ? colors.textMuted : colors.primary} />
      <Text style={[styles.text, partial ? styles.partial : null]} numberOfLines={2}>
        {label}
      </Text>
      <Pressable
        testID="dictation-stop"
        accessibilityRole="button"
        accessibilityLabel={t('Parar ditado')}
        hitSlop={8}
        onPress={() => closeRef.current()}
        style={({ pressed }) => [styles.stop, pressed && styles.pressed]}>
        <Text style={styles.stopText}>{state === 'error' ? t('Fechar') : t('Parar')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 40,
    backgroundColor: colors.primarySoft,
  },
  text: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 17 },
  partial: { color: colors.text },
  stop: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  stopText: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.8 },
}));
