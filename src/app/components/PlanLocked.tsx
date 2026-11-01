/**
 * Tela no lugar da Agenda e dos Clientes (CRM) quando o plano não inclui (plano
 * grátis). Os dados que já existem no aparelho continuam guardados: voltam ao assinar.
 */
import React from 'react';
import { t } from '../../i18n';
import type { IconName } from '../../keyboard/components/Icon';
import { openPlans } from '../../plans/plan';
import { Button, EmptyState, Page } from './ui';

export type LockedFeature = 'agenda' | 'crm';

const COPY: Record<LockedFeature, { icon: IconName; title: string; text: string }> = {
  agenda: {
    icon: 'calendario',
    title: 'A Agenda está nos planos pagos',
    text: 'Marque reuniões e tarefas com seus clientes e mande lembretes pelo teclado. Assine o Basic, o Plus ou o Pro para usar.',
  },
  crm: {
    icon: 'clientes',
    title: 'Os Clientes estão nos planos pagos',
    text: 'Organize seus clientes por etapa de venda e fale com eles pelo teclado. Assine o Basic, o Plus ou o Pro para usar.',
  },
};

export function PlanLocked({ feature }: { feature: LockedFeature }) {
  const copy = COPY[feature];
  return (
    <Page>
      <EmptyState icon={copy.icon} title={t(copy.title)} text={t(copy.text)} actionLabel={t('Ver planos')} onAction={openPlans} />
    </Page>
  );
}

/** Dependente: a assinatura da empresa venceu. Nada foi apagado; volta quando ela renovar. */
export function CompanyBlocked({ company, onLogout }: { company: string; onLogout: () => void }) {
  return (
    <Page>
      <EmptyState
        icon="escudo"
        title={t('Seu acesso está pausado')}
        text={
          company
            ? t('A assinatura de {company} venceu. Seu acesso volta assim que a empresa renovar. Nada foi apagado.', { company })
            : t('A assinatura da sua empresa venceu. Seu acesso volta assim que a empresa renovar. Nada foi apagado.')
        }
      />
      <Button label={t('Sair da conta')} variant="secondary" icon="sair" onPress={onLogout} />
    </Page>
  );
}
