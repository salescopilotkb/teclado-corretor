/**
 * "Sair da equipe" (funcionário da conta empresa): perde o acesso ao Locker da
 * empresa e a conta continua como uma conta KEYCON comum, no plano grátis. Os
 * produtos, atalhos, clientes e agenda do celular ficam; dá para assinar um plano.
 */
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { t } from '../../i18n';
import { CompanyError, leaveCompany } from '../../company/company';
import { resetLockerOwner } from '../../files/locker';
import { openPlans, refreshPlan } from '../../plans/plan';
import { Button } from './ui';

export function LeaveTeamButton({ company }: { company: string }) {
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    try {
      await leaveCompany();
      resetLockerOwner();
      await refreshPlan();
      Alert.alert(
        t('Você saiu da equipe'),
        t('Sua conta continua, agora só sua, no plano grátis. Para usar a Agenda, o CRM e o Locker, assine um plano.'),
        [
          { text: t('Agora não'), style: 'cancel' },
          { text: t('Ver planos'), onPress: () => setTimeout(openPlans, 300) },
        ],
      );
    } catch (e) {
      Alert.alert(t('Atenção'), e instanceof CompanyError ? e.message : t('Não foi possível concluir. Verifique a internet e tente de novo.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      t('Sair da equipe?'),
      company
        ? t('Você perde o acesso ao Locker de {company}. Sua conta continua no plano grátis, com os seus produtos, atalhos, clientes e agenda, e você pode assinar um plano quando quiser. Para voltar, a empresa precisa convidar você de novo.', { company })
        : t('Você perde o acesso ao Locker da empresa. Sua conta continua no plano grátis, com os seus produtos, atalhos, clientes e agenda, e você pode assinar um plano quando quiser. Para voltar, a empresa precisa convidar você de novo.'),
      [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Sair da equipe'), style: 'destructive', onPress: leave },
      ],
    );

  return <Button testID="team-leave" label={t('Sair da equipe')} variant="secondary" icon="sair" loading={busy} onPress={confirm} />;
}
