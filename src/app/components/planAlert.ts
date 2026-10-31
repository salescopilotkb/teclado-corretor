import { Alert } from 'react-native';
import { t } from '../../i18n';
import { canOpenPlans, openPlans } from '../../plans/plan';

/** Aviso de limite do plano grátis, com o atalho para a tela de planos. */
export function alertPlanLimit(message: string): void {
  Alert.alert(
    t('Atenção'),
    message,
    canOpenPlans()
      ? [
          { text: t('Agora não'), style: 'cancel' },
          { text: t('Ver planos'), onPress: openPlans },
        ]
      : undefined,
  );
}
