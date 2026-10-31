/**
 * Planos e assinatura: o plano atual, os três planos (Basic, Plus, Pro) com o
 * que cada um inclui, o teste grátis de 7 dias do Plus, Restaurar compras,
 * Gerenciar assinatura, o aviso de renovação automática e os Termos e a
 * Privacidade (as lojas exigem tudo isso na tela de compra).
 *
 * A compra é sempre pela loja do aparelho (src/plans/billing.ts).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { getLanguage, t } from '../../i18n';
import { makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Icon } from '../../keyboard/components/Icon';
import { lockerPlanName } from '../../files/limits';
import { PRIVACY, TERMS } from '../../legal/legal';
import {
  BillingError,
  DEVICE_STORE,
  listPrice,
  loadOffers,
  managedElsewhere,
  openManageSubscription,
  PAID_PLANS,
  purchase,
  restorePurchases,
  TRIAL_DAYS,
  TRIAL_PLAN,
} from '../../plans/billing';
import type { PaidPlan, StoreOffer } from '../../plans/billing';
import { refreshPlan } from '../../plans/plan';
import type { PlanInfo } from '../../plans/plan';
import { usePlan } from '../../plans/usePlan';
import { Button, Card, CardText, CardTitle, Page, SubHeader } from '../components/ui';
import { LegalScreen } from './ProfileSettingsScreen';

/** O que cada plano inclui (o mesmo de supabase/plans.sql). */
const FEATURES: Record<PaidPlan, { storage: string; items: string[] }> = {
  basic: {
    storage: '5 GB',
    items: [
      'Teclado completo, Agenda e Clientes (CRM)',
      'Produtos, atalhos e arquivos sem limite',
      'Locker no computador',
      'Compartilhe com até 3 pessoas',
      'Vídeos de até 64 MB',
      'Lixeira guarda por 30 dias',
    ],
  },
  plus: {
    storage: '20 GB',
    items: [
      'Tudo do Basic',
      'Compartilhe com quantas pessoas quiser',
      '1 equipe com até 5 pessoas',
      'Pasta por link e vitrine pública',
      'Arquivos sem internet no computador',
      'Vídeos de até 256 MB',
      'Lixeira guarda por 60 dias',
    ],
  },
  pro: {
    storage: '100 GB',
    items: ['Tudo do Plus', '5 equipes com até 50 pessoas', 'Vídeos de até 1 GB', 'Lixeira guarda por 90 dias', 'Suporte prioritário'],
  },
};

/** "26/10/2026" (ou "10/26/2026" em inglês). */
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return getLanguage() === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

export function PlansScreen({ onBack }: { onBack: () => void }) {
  const styles = useStyles();
  const plan = usePlan();
  const [offers, setOffers] = useState<StoreOffer[] | null>(null);
  const [busy, setBusy] = useState<PaidPlan | 'restore' | null>(null);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    refreshPlan().catch(() => {});
    loadOffers()
      .then(setOffers)
      .catch(() => setOffers(null));
  }, []);

  if (legal) return <LegalScreen doc={legal === 'terms' ? TERMS : PRIVACY} onBack={() => setLegal(null)} />;

  const elsewhere = managedElsewhere();
  const offerOf = (p: PaidPlan) => offers?.find(o => o.plan === p);
  // Teste grátis: a loja diz quem ainda tem direito; sem a loja, só quem nunca assinou
  const trialFor = (p: PaidPlan) => p === TRIAL_PLAN && (offerOf(p)?.trial ?? plan.status === 'free');

  const buy = async (p: PaidPlan) => {
    setBusy(p);
    try {
      const result = await purchase(p);
      if (result === 'ok') {
        await refreshPlan();
        Alert.alert(t('Pronto!'), t('Seu plano {plan} já está valendo no app, no teclado e no Locker.', { plan: lockerPlanName(p) }));
      }
    } catch (e) {
      Alert.alert(t('Atenção'), e instanceof BillingError ? e.message : t('Não foi possível concluir a assinatura. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const result = await restorePurchases();
      Alert.alert(
        result === 'restored' ? t('Compras restauradas') : t('Nenhuma assinatura encontrada'),
        result === 'restored'
          ? t('Sua assinatura voltou a valer neste aparelho.')
          : t('Não achamos assinatura ativa na conta da loja deste aparelho.'),
      );
    } catch (e) {
      Alert.alert(t('Atenção'), e instanceof BillingError ? e.message : t('Não foi possível restaurar agora. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <SubHeader title={t('Planos e assinatura')} onBack={onBack} />

      <CurrentPlan plan={plan} />

      {elsewhere ? (
        <Card>
          <CardTitle>{t('Sua assinatura é de outra loja')}</CardTitle>
          <CardText>
            {plan.store === 'app_store'
              ? t(
                  'Você assinou pela App Store. O plano vale aqui também; para mudar ou cancelar, use a App Store (no iPhone, em Ajustes › seu nome › Assinaturas).',
                )
              : t(
                  'Você assinou pela Google Play. O plano vale aqui também; para mudar ou cancelar, use a Google Play (play.google.com › Pagamentos e assinaturas).',
                )}
          </CardText>
        </Card>
      ) : null}

      {PAID_PLANS.map(p => {
        const current = plan.plan === p && (plan.status === 'active' || plan.status === 'trial');
        const trial = trialFor(p);
        const price = offerOf(p)?.price ?? listPrice(p);
        return (
          <PlanCard
            key={p}
            plan={p}
            price={price}
            current={current}
            trial={trial}
            disabled={elsewhere || (busy !== null && busy !== p)}
            loading={busy === p}
            label={
              current
                ? t('Seu plano atual')
                : trial
                  ? t('Começar {days} dias grátis', { days: TRIAL_DAYS })
                  : plan.status === 'active' || plan.status === 'trial'
                    ? t('Mudar para o {plan}', { plan: lockerPlanName(p) })
                    : t('Assinar o {plan}', { plan: lockerPlanName(p) })
            }
            onPress={() => buy(p)}
          />
        );
      })}

      <View style={styles.links}>
        <Button
          label={t('Restaurar compras')}
          variant="secondary"
          loading={busy === 'restore'}
          disabled={busy !== null && busy !== 'restore'}
          onPress={restore}
        />
        <Button
          label={t('Gerenciar assinatura')}
          variant="secondary"
          icon="configuracoes"
          onPress={() => openManageSubscription().catch(() => Alert.alert(t('Erro'), t('Não foi possível abrir a loja.')))}
        />
      </View>

      <Text style={styles.disclosure}>
        {DEVICE_STORE === 'app_store'
          ? t(
              'A assinatura é mensal e renova sozinha pelo mesmo preço até você cancelar. O pagamento é cobrado na sua conta Apple ao confirmar a compra. Para não ser cobrado no próximo mês, cancele até 24 horas antes da renovação, em Ajustes › seu nome › Assinaturas. No teste grátis de {days} dias do Plus, a cobrança começa no fim do teste, a menos que você cancele antes.',
              { days: TRIAL_DAYS },
            )
          : t(
              'A assinatura é mensal e renova sozinha pelo mesmo preço até você cancelar. O pagamento é cobrado na sua conta Google ao confirmar a compra. Para não ser cobrado no próximo mês, cancele antes da renovação, na Google Play › Pagamentos e assinaturas. No teste grátis de {days} dias do Plus, a cobrança começa no fim do teste, a menos que você cancele antes.',
              { days: TRIAL_DAYS },
            )}
      </Text>

      <View style={styles.legalRow}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => setLegal('terms')}>
          <Text style={styles.legalLink}>{t('Termos de Uso')}</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => setLegal('privacy')}>
          <Text style={styles.legalLink}>{t('Política de Privacidade')}</Text>
        </Pressable>
      </View>
    </Page>
  );
}

/** O plano de agora e o que acontece com ele (renova, teste, vencida). */
function CurrentPlan({ plan }: { plan: PlanInfo }) {
  // Servidor ainda sem os planos (plans.sql): não há plano para mostrar
  if (plan.status === 'open') return null;
  const name = lockerPlanName(plan.plan);
  let text: string;
  if (plan.status === 'trial' && plan.expiresAt) {
    text = t('Teste grátis do Plus até {date}. Depois, a assinatura começa sozinha, a menos que você cancele.', {
      date: formatDate(plan.expiresAt),
    });
  } else if (plan.status === 'active' && plan.expiresAt) {
    text = plan.willRenew
      ? t('Renova em {date}.', { date: formatDate(plan.expiresAt) })
      : t('Cancelada: vale até {date}. Depois, a conta volta ao plano grátis.', { date: formatDate(plan.expiresAt) });
  } else if (plan.status === 'active') {
    text = t('Plano ativo.');
  } else if (plan.status === 'expired' && plan.graceUntil) {
    text = t('Sua assinatura venceu. Seus arquivos ficam guardados até {date}: assine de novo para não perder nada.', {
      date: formatDate(plan.graceUntil),
    });
  } else {
    text = t(
      'Plano grátis: 1 pasta com 3 produtos, 1 pasta com 3 arquivos e 1 atalho de cada tipo. Sem Agenda, Clientes e Locker no computador.',
    );
  }
  return (
    <Card>
      <CardTitle>
        {t('Seu plano: {plan}', {
          plan: plan.status === 'expired' ? lockerPlanName('free') : name,
        })}
      </CardTitle>
      <CardText>{text}</CardText>
    </Card>
  );
}

function PlanCard({
  plan,
  price,
  current,
  trial,
  label,
  disabled,
  loading,
  onPress,
}: {
  plan: PaidPlan;
  price: string;
  current: boolean;
  trial: boolean;
  label: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const features = FEATURES[plan];
  return (
    <Card style={current ? styles.cardCurrent : undefined}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.name}>{lockerPlanName(plan)}</Text>
          <Text style={styles.storage}>{t('{size} no Locker', { size: features.storage })}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.price}>{price}</Text>
          <Text style={styles.per}>{t('por mês')}</Text>
        </View>
      </View>
      {trial ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('{days} dias grátis para experimentar', { days: TRIAL_DAYS })}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {features.items.map(item => (
          <View key={item} style={styles.item}>
            <Icon name="check" size={16} color={colors.primaryText} />
            <Text style={styles.itemText}>{t(item)}</Text>
          </View>
        ))}
      </View>
      <Button
        testID={`plan-${plan}`}
        label={label}
        variant={current ? 'secondary' : 'primary'}
        disabled={current || disabled}
        loading={loading}
        onPress={onPress}
      />
    </Card>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  cardCurrent: { borderWidth: 2, borderColor: colors.primary },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  name: { ...typography.h2, color: colors.text },
  storage: { ...typography.label, color: colors.textMuted, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { ...typography.title, color: colors.text },
  per: { ...typography.caption, color: colors.textMuted },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  badgeText: { ...typography.caption, color: colors.primaryText },
  list: { gap: spacing.sm, marginVertical: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemText: { ...typography.body, color: colors.text, flex: 1 },
  links: { gap: spacing.sm, marginTop: spacing.sm },
  disclosure: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  legalLink: {
    ...typography.label,
    color: colors.primaryText,
    textDecorationLine: 'underline',
  },
  legalDot: { color: colors.textMuted },
}));
