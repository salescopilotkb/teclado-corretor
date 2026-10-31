/**
 * Escolher o que manter: a conta passou do limite do plano (assinatura vencida ou
 * plano menor) e tem 30 dias para decidir. Cada arquivo tem "Manter"; já vem
 * marcado o que ficaria se a pessoa não escolhesse (os mais antigos, até caber).
 * "Apagar os não marcados" apaga do app, do teclado e da nuvem.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { getLanguage, t } from '../../i18n';
import { makeStyles, spacing, typography, useColors } from '../../keyboard/theme';
import { fileIcon, Icon } from '../../keyboard/components/Icon';
import { formatBytes, lockerPlanName } from '../../files/limits';
import { lockerDeleteFile } from '../../files/locker';
import { deleteUploadedMedia } from '../../services/mediaUpload';
import { Repo } from '../../storage/storage';
import { countedSize, defaultKeep, fits } from '../../plans/keep';
import { daysUntil, openPlans, overLimitDeadline, refreshPlan } from '../../plans/plan';
import { usePlan } from '../../plans/usePlan';
import { Button, Card, CardText, CardTitle, EmptyState, Page, SubHeader } from '../components/ui';

/** "26/10/2026" (ou "10/26/2026" em inglês). */
function formatDate(date: Date): string {
  const iso = date.toISOString();
  const [y, m, d] = iso.slice(0, 10).split('-');
  return getLanguage() === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

export function KeepFilesScreen({ onBack }: { onBack: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const plan = usePlan();
  const lang = getLanguage();
  const [files, setFiles] = useState(() => Repo.getFiles().files);
  const limits = plan.limits;
  const [keep, setKeep] = useState<Set<string>>(() => defaultKeep(files, limits));
  const [deleting, setDeleting] = useState(false);
  // O plano pode chegar do servidor depois de abrir: refaz a sugestão enquanto a pessoa não mexeu
  const touched = useRef(false);
  const limitsKey = JSON.stringify(limits);
  useEffect(() => {
    if (!touched.current) setKeep(defaultKeep(files, limits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitsKey, files]);

  // Mais novos primeiro: são os que sairiam se a pessoa não escolher
  const ordered = useMemo(() => [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [files]);
  const kept = files.filter(f => keep.has(f.id));
  const keptBytes = kept.reduce((sum, f) => sum + countedSize(f), 0);
  const ok = fits(files, keep, limits);
  const toDelete = files.filter(f => !keep.has(f.id));
  const deadline = overLimitDeadline(plan);

  const toggle = (id: string, value: boolean) => {
    touched.current = true;
    setKeep(prev => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const removeUnchecked = () => {
    if (!toDelete.length) return;
    Alert.alert(
      t('Apagar arquivos'),
      toDelete.length === 1
        ? t('Apagar 1 arquivo do app, do teclado e do Locker? Não dá para desfazer.')
        : t('Apagar {n} arquivos do app, do teclado e do Locker? Não dá para desfazer.', { n: toDelete.length }),
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Apagar'),
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            toDelete.forEach(f => {
              lockerDeleteFile(f.id);
              deleteUploadedMedia(f.storagePath);
            });
            const rest = Repo.getFiles().files;
            setFiles(rest);
            setKeep(new Set(rest.map(f => f.id)));
            setDeleting(false);
            // O servidor confere de novo (a fila sobe as exclusões antes)
            setTimeout(() => refreshPlan().catch(() => {}), 3000);
          },
        },
      ],
    );
  };

  if (!files.length) {
    return (
      <Page>
        <SubHeader title={t('Escolher o que manter')} onBack={onBack} />
        <EmptyState icon="pasta" title={t('Nenhum arquivo')} text={t('Você não tem arquivos no Locker.')} />
      </Page>
    );
  }

  const limitText = [
    limits.limitBytes !== null ? formatBytes(limits.limitBytes, lang) : null,
    limits.maxFiles !== null ? (limits.maxFiles === 1 ? t('1 arquivo') : t('{n} arquivos', { n: limits.maxFiles })) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Page>
      <SubHeader title={t('Escolher o que manter')} onBack={onBack} />

      <Card>
        <CardTitle>
          {t('O plano {plan} guarda até {limit}', {
            plan: lockerPlanName(plan.status === 'expired' ? 'free' : plan.plan),
            limit: limitText,
          })}
        </CardTitle>
        <CardText>
          {deadline
            ? t(
                'Marque o que você quer manter. Se não escolher até {date} ({days} dias), saem os arquivos mais recentes que passam do limite: os que já estão desmarcados abaixo.',
                {
                  date: formatDate(deadline),
                  days: daysUntil(deadline),
                },
              )
            : t(
                'Marque o que você quer manter. Se não escolher, saem os arquivos mais recentes que passam do limite: os que já estão desmarcados abaixo.',
              )}
        </CardText>
        {limits.maxFolders === 1 ? <CardText>{t('No plano grátis, o que ficar vai para uma pasta só.')}</CardText> : null}
      </Card>

      <View style={[styles.summary, ok ? styles.summaryOk : styles.summaryOver]}>
        <Text style={styles.summaryText}>
          {t('Mantendo {n} de {total} arquivos · {size}', { n: kept.length, total: files.length, size: formatBytes(keptBytes, lang) })}
        </Text>
        <Text style={styles.summaryHint}>{ok ? t('Cabe no plano.') : t('Ainda passa do limite: desmarque mais arquivos.')}</Text>
      </View>

      <Card>
        {ordered.map(f => (
          <View key={f.id} style={styles.row}>
            <Icon name={fileIcon(f.type)} size={20} color={colors.textMuted} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {f.title}
              </Text>
              <Text style={styles.meta}>
                {formatDate(new Date(f.createdAt))}
                {countedSize(f) ? ` · ${formatBytes(countedSize(f), lang)}` : ''}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('Manter {name}', { name: f.title })}
              value={keep.has(f.id)}
              onValueChange={v => toggle(f.id, v)}
              trackColor={{ true: colors.primary, false: colors.textMuted }}
            />
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button
          label={toDelete.length === 1 ? t('Apagar 1 arquivo não marcado') : t('Apagar {n} arquivos não marcados', { n: toDelete.length })}
          variant="danger"
          loading={deleting}
          disabled={!toDelete.length}
          onPress={removeUnchecked}
        />
        <Button label={t('Ver planos')} variant="secondary" onPress={openPlans} />
      </View>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  name: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  summary: { borderRadius: 14, padding: spacing.md, gap: 2, borderWidth: 1 },
  summaryOk: { borderColor: colors.success },
  summaryOver: { borderColor: colors.primary },
  summaryText: { ...typography.title, color: colors.text },
  summaryHint: { ...typography.label, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
}));
