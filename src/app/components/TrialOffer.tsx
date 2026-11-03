/**
 * Boas-vindas com o teste grátis do Plus: aparece uma vez por conta, no primeiro
 * acesso depois do tutorial, para quem está no plano grátis e ainda tem direito ao
 * teste (a loja confirma: na Google, a oferta trial7 só vem para quem nunca assinou;
 * na Apple, a elegibilidade da oferta introdutória).
 *
 * O teste é uma assinatura da loja: a pessoa confirma o Plus agora, não paga nada nos
 * 7 dias e a cobrança mensal começa no fim do teste, a menos que cancele antes.
 * Sem a cobrança ligada (chaves do RevenueCat vazias), o popup não aparece.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Icon } from '../../keyboard/components/Icon';
import { BillingError, billingEnabled, DEVICE_STORE, loadOffers, purchase, TRIAL_DAYS, TRIAL_PLAN } from '../../plans/billing';
import { openPlans } from '../../plans/plan';
import { usePlan } from '../../plans/usePlan';
import { Repo, storage } from '../../storage/storage';
import { Button } from './ui';

const seenKey = (userId: string) => `plan.trialOffer.${userId}`;

const BENEFITS = [
  '20 GB no Locker para fotos e vídeos',
  'Agenda e Clientes (CRM)',
  'Produtos, atalhos e arquivos sem limite',
  '1 equipe com até 5 pessoas',
];

export function TrialOffer({ enabled }: { enabled: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const plan = usePlan();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eligibleNow = enabled && plan.status === 'free' && plan.role !== 'dependent';

  useEffect(() => {
    const userId = Repo.getUserId();
    if (!eligibleNow || !userId || !billingEnabled() || storage.getString(seenKey(userId))) return;
    let alive = true;
    // A cobrança liga logo depois do login (startBilling): tenta algumas vezes
    (async () => {
      for (let i = 0; i < 5 && alive; i++) {
        const offers = await loadOffers().catch(() => null);
        const plus = offers?.find(o => o.plan === TRIAL_PLAN);
        if (plus) {
          if (alive && plus.trial) {
            storage.set(seenKey(userId), new Date().toISOString());
            setPrice(plus.price);
          }
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    })();
    return () => {
      alive = false;
    };
  }, [eligibleNow]);

  if (!price) return null;
  const close = () => setPrice(null);

  const start = async () => {
    setBusy(true);
    try {
      const result = await purchase(TRIAL_PLAN);
      if (result === 'ok') {
        close();
        Alert.alert(t('Pronto!'), t('Seu teste grátis do Plus começou. Aproveite os {days} dias.', { days: TRIAL_DAYS }));
      }
    } catch (e) {
      Alert.alert(t('Atenção'), e instanceof BillingError ? e.message : t('Não foi possível concluir a assinatura. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('{days} dias grátis', { days: TRIAL_DAYS })}</Text>
            </View>
            <Text style={styles.title}>{t('Experimente o Plus grátis por {days} dias', { days: TRIAL_DAYS })}</Text>
            <View style={styles.list}>
              {BENEFITS.map(b => (
                <View key={b} style={styles.item}>
                  <Icon name="check" size={18} color={colors.primary} />
                  <Text style={styles.itemText}>{t(b)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.terms}>
              {DEVICE_STORE === 'app_store'
                ? t(
                    'Você confirma a assinatura na App Store agora, mas não paga nada durante o teste. Depois de {days} dias, o Plus custa {price} por mês, cobrado na sua conta Apple e renovado todo mês. Cancele até 24 horas antes do fim do teste e não será cobrado.',
                    { days: TRIAL_DAYS, price },
                  )
                : t(
                    'Você confirma a assinatura na Google Play agora, mas não paga nada durante o teste. Depois de {days} dias, o Plus custa {price} por mês, cobrado na sua conta Google e renovado todo mês. Cancele antes do fim do teste e não será cobrado.',
                    { days: TRIAL_DAYS, price },
                  )}
            </Text>
            <Button label={t('Começar {days} dias grátis', { days: TRIAL_DAYS })} loading={busy} onPress={start} />
            <Pressable
              accessibilityRole="button"
              style={styles.link}
              disabled={busy}
              onPress={() => {
                close();
                openPlans();
              }}>
              <Text style={styles.linkText}>{t('Ver todos os planos')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.link} disabled={busy} onPress={close}>
              <Text style={styles.laterText}>{t('Agora não')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  content: { padding: spacing.xl, gap: spacing.md },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeText: { ...typography.caption, color: colors.primaryText },
  title: { ...typography.h2, color: colors.text },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemText: { ...typography.body, color: colors.text, flex: 1 },
  terms: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.primaryText },
  laterText: { ...typography.label, color: colors.textMuted },
}));
