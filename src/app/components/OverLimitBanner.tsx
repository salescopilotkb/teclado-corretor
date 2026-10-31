/**
 * Passou do limite do plano (assinatura vencida ou plano menor): "Faltam X dias
 * para você perder seus arquivos.", com os caminhos para escolher o que manter ou
 * mudar de plano. Aparece no Início e no Locker enquanto durar o prazo.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Icon } from '../../keyboard/components/Icon';
import { lockerPlanName } from '../../files/limits';
import { daysUntil, openKeepFiles, openPlans, overLimitDeadline } from '../../plans/plan';
import { usePlan } from '../../plans/usePlan';
import { Button } from './ui';

export function OverLimitBanner() {
  const styles = useStyles();
  const colors = useColors();
  const plan = usePlan();
  if (!plan.overLimit || plan.status === 'open') return null;
  const deadline = overLimitDeadline(plan);
  const days = deadline ? daysUntil(deadline) : null;

  const title =
    days === null
      ? t('Você passou do limite do seu plano.')
      : days === 0
        ? t('Hoje é o último dia para escolher seus arquivos.')
        : days === 1
          ? t('Falta 1 dia para você perder seus arquivos.')
          : t('Faltam {days} dias para você perder seus arquivos.', { days });
  const text =
    plan.status === 'expired' || plan.plan === 'free'
      ? t(
          'O plano grátis guarda 1 pasta com 3 arquivos. Assine um plano para manter tudo, ou escolha o que fica: o resto será apagado no fim do prazo.',
        )
      : t(
          'O plano {plan} tem menos espaço do que você usa. Mude para um plano maior, ou escolha o que fica: o resto será apagado no fim do prazo.',
          {
            plan: lockerPlanName(plan.plan),
          },
        );

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.head}>
        <Icon name="info" size={20} color={colors.primaryText} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.actions}>
        <Button label={t('Escolher o que manter')} variant="secondary" onPress={openKeepFiles} />
        <Button label={t('Ver planos')} onPress={openPlans} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  banner: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.text, flex: 1 },
  text: { ...typography.body, color: colors.text },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
}));
