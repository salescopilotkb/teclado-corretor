import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { coralGlass, makeStyles, onCoralText, radius, spacing, touchTarget } from '../theme';
import { CoralSheen } from './Glass';
import { KeyconMark } from './KeyconLogo';

/**
 * No lugar da Agenda e do CRM do teclado quando o plano não inclui (plano grátis).
 * A assinatura é feita no app (as lojas não deixam comprar dentro do teclado).
 */
export function PlanLockedPanel({ feature }: { feature: 'agenda' | 'crm' | 'blocked' }) {
  const styles = useStyles();
  return (
    <View style={styles.container} testID={`plan-locked-${feature}`}>
      <KeyconMark size={36} />
      <Text style={styles.title}>
        {feature === 'blocked'
          ? t('Seu acesso está pausado')
          : feature === 'agenda'
            ? t('A Agenda está nos planos pagos')
            : t('Os Clientes estão nos planos pagos')}
      </Text>
      <Text style={styles.desc}>
        {feature === 'blocked'
          ? t('A assinatura da sua empresa venceu. O acesso volta assim que ela renovar. O botão ABC continua disponível para digitar.')
          : t('Assine no app KEYCON para usar aqui no teclado. O botão ABC continua disponível para digitar.')}
      </Text>
      {KeyboardBridge.canOpenApp && feature !== 'blocked' ? (
        <Pressable
          testID="plan-locked-open-app"
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => KeyboardBridge.openApp()}>
          <CoralSheen radius={radius.md} />
          <Text style={styles.btnText}>{t('Abrir o app')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  desc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    ...coralGlass(colors, { pill: false }),
  },
  pressed: { opacity: 0.85 },
  btnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
    ...onCoralText,
  },
}));
