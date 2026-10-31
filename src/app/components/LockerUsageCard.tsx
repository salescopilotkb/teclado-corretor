/**
 * Medidor de espaço do Locker: quanto a pessoa já usou do plano (Basic 5 GB,
 * Plus 20 GB, Pro 100 GB ou Enterprise personalizado). Relê quando os arquivos
 * mudam (envio, exclusão, outro aparelho, Locker web).
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getLanguage, t } from '../../i18n';
import { formatBytes, LOCKER_PLANS } from '../../files/limits';
import { lockerUsage, onLockerChange } from '../../files/locker';
import type { LockerUsage } from '../../files/locker';
import { makeStyles, radius, spacing } from '../../keyboard/theme';
import { Card, CardTitle } from './ui';

/** A partir daqui a barra fica vermelha e aparece o aviso. */
const ALMOST_FULL = 0.9;

export function LockerUsageCard({ refreshKey }: { refreshKey?: unknown }) {
  const styles = useStyles();
  const [usage, setUsage] = useState<LockerUsage | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () =>
      lockerUsage().then(u => {
        if (alive) setUsage(u);
      });
    read();
    const off = onLockerChange(read);
    return () => {
      alive = false;
      off();
    };
  }, [refreshKey]);

  if (!usage) return null;
  const lang = getLanguage();
  const fraction = usage.limit > 0 ? Math.min(1, usage.used / usage.limit) : 0;
  const almostFull = fraction >= ALMOST_FULL;
  const plan = LOCKER_PLANS[usage.plan];

  return (
    <Card>
      <View style={styles.head}>
        <CardTitle>{t('Espaço do Locker')}</CardTitle>
        <Text style={styles.plan}>{t('Plano {plan}', { plan: plan.name })}</Text>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
        <View style={[styles.fill, almostFull && styles.fillFull, { width: `${Math.max(fraction * 100, usage.used > 0 ? 2 : 0)}%` }]} />
      </View>
      <Text style={styles.amount}>
        {t('{used} de {limit} usados', { used: formatBytes(usage.used, lang), limit: formatBytes(usage.limit, lang) })}
        {usage.estimate ? ` · ${t('estimativa deste aparelho')}` : ''}
      </Text>
      {usage.plan === 'enterprise' ? (
        <Text style={styles.note}>{t('Espaço personalizado do seu plano. Para mudar, fale com o suporte.')}</Text>
      ) : almostFull ? (
        <Text style={[styles.note, styles.noteFull]}>
          {t('Seu Locker está quase cheio. Libere espaço ou mude de plano: Basic 5 GB, Plus 20 GB, Pro 100 GB ou Enterprise.')}
        </Text>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles(colors => ({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  plan: { fontSize: 12, fontWeight: '700', color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.6 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  fillFull: { backgroundColor: colors.danger },
  amount: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  note: { fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  noteFull: { color: colors.danger },
}));
