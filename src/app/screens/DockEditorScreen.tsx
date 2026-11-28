/**
 * Personalizar a barra de baixo do app (Início › Personalizar a barra, ou segurar
 * um ícone da barra). O Início fica sempre na frente; a pessoa escolhe até 4
 * outros, na ordem em que toca. Vale na hora e entra na cópia na nuvem.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, spacing } from '../../keyboard/theme';
import { AppIcon } from '../components/AppIcon';
import { Button, Card, CardText, CardTitle, Page, SubHeader } from '../components/ui';
import { DEFAULT_DOCK, DOCK_MAX, dockChoices, homeApp, setDock } from '../homeApps';
import type { HomeAppId } from '../homeApps';

interface Props {
  dock: HomeAppId[];
  hidden: HomeAppId[];
  onChange: (ids: HomeAppId[]) => void;
  onBack: () => void;
}

const COLUMNS = 3;

export function DockEditorScreen({ dock, hidden, onChange, onBack }: Props) {
  const styles = useStyles();
  const [selected, setSelected] = useState<HomeAppId[]>(dock.filter(id => !hidden.includes(id)));
  const full = selected.length >= DOCK_MAX;

  const apply = (ids: HomeAppId[]) => {
    setSelected(ids);
    setDock(ids);
    onChange(ids);
  };

  const toggle = (id: HomeAppId) => {
    if (selected.includes(id)) apply(selected.filter(x => x !== id));
    else if (!full) apply([...selected, id]);
  };

  const choices = dockChoices(hidden);
  const rows = [];
  for (let i = 0; i < choices.length; i += COLUMNS) rows.push(choices.slice(i, i + COLUMNS));

  return (
    <Page>
      <SubHeader title={t('Personalizar a barra')} onBack={onBack} />

      <Card>
        <CardTitle>{t('Sua barra')}</CardTitle>
        <View style={styles.preview}>
          <AppIcon label={t('Início')} icon="casa" tint={c => c.primary} size={40} labelLines={1} labelSize={11} onPress={() => {}} />
          {selected.map(id => {
            const app = homeApp(id);
            return (
              <AppIcon
                key={id}
                label={app.label}
                icon={app.icon}
                tint={app.tint}
                size={40}
                labelLines={1}
                labelSize={11}
                onPress={() => toggle(id)}
              />
            );
          })}
        </View>
        <CardText>
          {t('O Início fica sempre na barra. Escolha até {max} ícones abaixo, na ordem em que quer vê-los.', { max: DOCK_MAX })}
        </CardText>
      </Card>

      <Card>
        <View style={styles.headRow}>
          <CardTitle>{t('Ícones')}</CardTitle>
          <Text style={styles.count}>{t('{n} de {max}', { n: selected.length, max: DOCK_MAX })}</Text>
        </View>
        <View style={styles.grid}>
          {rows.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map(app => {
                const checked = selected.includes(app.id);
                return (
                  <View key={app.id} style={styles.gridCell}>
                    <AppIcon
                      testID={`dock-choice-${app.id}`}
                      label={app.label}
                      icon={app.icon}
                      tint={app.tint}
                      size={52}
                      checked={checked}
                      dimmed={full && !checked}
                      onPress={() => toggle(app.id)}
                    />
                  </View>
                );
              })}
              {Array.from({ length: COLUMNS - row.length }, (_, i) => (
                <View key={`empty-${i}`} style={styles.gridCell} />
              ))}
            </View>
          ))}
        </View>
        {full && <Text style={styles.hint}>{t('A barra está cheia. Toque num ícone marcado para tirá-lo.')}</Text>}
      </Card>

      <Button label={t('Voltar à barra padrão')} variant="secondary" onPress={() => apply(DEFAULT_DOCK.filter(id => !hidden.includes(id)))} />
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  preview: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
  grid: { gap: spacing.lg, paddingTop: spacing.sm },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, alignItems: 'center' },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
}));
