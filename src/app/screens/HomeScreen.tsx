/**
 * Início — imita a tela inicial de um celular: os "apps" do KEYCON em ícones
 * quadrados (3 por linha) com o nome embaixo. A barra de baixo (App.tsx) é
 * personalizável em "Personalizar a barra". O detalhe de cada assunto fica num submenu.
 */
import { t } from '../../i18n';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon, IconTile } from '../../keyboard/components/Icon';
import { makeStyles, spacing, useColors } from '../../keyboard/theme';
import { getSegment } from '../../segments/segments';
import { Repo } from '../../storage/storage';
import { Button, Card, CardText, Page, ProgressBar, ScreenTitle, StatusChip, SubHeader } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { homeApps } from '../homeApps';
import type { HomeApp, HomeAppId } from '../homeApps';
import { buildSteps } from '../onboarding/steps';
import type { OnboardingStep, StepTarget } from '../onboarding/steps';
import { isKeyboardReadyNow, KeyboardSetupScreen, KeyboardTestScreen, useKeyboardStatus } from './KeyboardSetupScreen';
import { ShortcutsManagerScreen } from './ShortcutsManagerScreen';
import { DockEditorScreen } from './DockEditorScreen';
import { OverLimitBanner } from '../components/OverLimitBanner';

export type HomeSection = 'root' | 'install' | 'steps' | 'test' | 'shortcuts' | 'dock' | 'keyboard';
type OpenSection = Exclude<HomeSection, 'keyboard'>;

/** Destinos fora do Início (outras abas do app). */
export type AppTarget = Extract<StepTarget, 'account-data' | 'catalog'> | 'files';

interface Props {
  onNavigate: (target: AppTarget) => void;
  /** Apps que abrem fora do Início (abas, planos, tutorial). */
  onOpenApp: (id: HomeAppId) => void;
  /** Abre direto num submenu (ex.: "Atalhos" tocado na barra). "keyboard" = instalar ou testar. */
  initialSection?: HomeSection;
  dock: HomeAppId[];
  onDockChange: (ids: HomeAppId[]) => void;
  /** Apps que não valem para esta conta (ex.: Planos para quem usa a conta da empresa). */
  hidden: HomeAppId[];
}

export function HomeScreen({ onNavigate, onOpenApp, initialSection = 'root', dock, onDockChange, hidden }: Props) {
  const styles = useStyles();
  const [section, setSection] = useState<OpenSection>(() =>
    initialSection === 'keyboard' ? (isKeyboardReadyNow() ? 'test' : 'install') : initialSection,
  );
  const keyboard = useKeyboardStatus();
  const segment = getSegment(Repo.getSegment());
  const back = () => setSection('root');

  const go = (target: StepTarget) => {
    if (target === 'install' || target === 'test' || target === 'shortcuts') setSection(target);
    else onNavigate(target);
  };

  if (section === 'install') return <KeyboardSetupScreen onBack={back} />;
  if (section === 'shortcuts') {
    return (
      <View style={styles.flexOnly}>
        <View style={styles.subHeaderBar}>
          <SubHeader title={t('Atalhos')} onBack={back} />
        </View>
        <ShortcutsManagerScreen />
      </View>
    );
  }
  if (section === 'test') return <KeyboardTestScreen onBack={back} />;
  if (section === 'dock') return <DockEditorScreen dock={dock} hidden={hidden} onChange={onDockChange} onBack={back} />;

  // Recalculado a cada volta ao Início (os submenus podem ter concluído passos)
  const steps = buildSteps(segment, keyboard.enabled);
  if (section === 'steps') return <StepsScreen steps={steps} onBack={back} onGo={go} />;

  const keyboardReady = keyboard.selected === true || (keyboard.selected === null && steps[0].done);
  const open = (id: HomeAppId) => {
    if (id === 'shortcuts' || id === 'steps') setSection(id);
    else if (id === 'keyboard') setSection(keyboardReady ? 'test' : 'install');
    else onOpenApp(id);
  };

  return (
    <HomeRoot
      steps={steps}
      keyboardReady={keyboardReady}
      dock={dock}
      hidden={hidden}
      onOpen={open}
      onEditDock={() => setSection('dock')}
    />
  );
}

const GRID_COLUMNS = 3;

interface RootProps {
  steps: OnboardingStep[];
  keyboardReady: boolean;
  dock: HomeAppId[];
  hidden: HomeAppId[];
  onOpen: (id: HomeAppId) => void;
  onEditDock: () => void;
}

/** Tela inicial de celular: ícones em grade (3 por linha) com o nome embaixo. */
function HomeRoot({ steps, keyboardReady, dock, hidden, onOpen, onEditDock }: RootProps) {
  const colors = useColors();
  const styles = useStyles();
  const seller = Repo.getSeller();
  const segment = getSegment(seller.segment);
  const firstName = seller.name.trim().split(/\s+/)[0];
  const pending = steps.filter(s => !s.done).length;

  // Quem está na barra sai da grade (como num celular); "Primeiros passos" some quando tudo está feito
  const apps = homeApps([...hidden, ...dock, ...(pending ? [] : (['steps'] as HomeAppId[]))]);
  const rows: HomeApp[][] = [];
  for (let i = 0; i < apps.length; i += GRID_COLUMNS) rows.push(apps.slice(i, i + GRID_COLUMNS));

  const badgeOf = (id: HomeAppId): string | true | undefined => {
    if (id === 'keyboard' && !keyboardReady) return true;
    if (id === 'steps' && pending) return String(pending);
    return undefined;
  };

  return (
    <Page>
      <ScreenTitle
        overline={seller.business || segment.label}
        title={firstName ? t('Olá, {firstName}', { firstName }) : t('Olá!')}
      />

      {/* Passou do limite do plano: faltam X dias para escolher o que manter */}
      <OverLimitBanner />

      <View style={styles.grid}>
        {rows.map((row, r) => (
          <View key={r} style={styles.gridRow}>
            {row.map(app => (
              <View key={app.id} style={styles.gridCell}>
                <AppIcon
                  testID={`home-app-${app.id}`}
                  label={app.label}
                  icon={app.icon}
                  tint={app.tint}
                  badge={badgeOf(app.id)}
                  onPress={() => onOpen(app.id)}
                />
              </View>
            ))}
            {/* Linha incompleta: células vazias para os ícones não se espalharem */}
            {Array.from({ length: GRID_COLUMNS - row.length }, (_, i) => (
              <View key={`empty-${i}`} style={styles.gridCell} />
            ))}
          </View>
        ))}
      </View>

      <Pressable testID="home-edit-dock" style={styles.editDock} onPress={onEditDock} accessibilityRole="button">
        <Icon name="editar" size={16} color={colors.primaryText} />
        <Text style={styles.editDockText}>{t('Personalizar a barra')}</Text>
      </Pressable>
    </Page>
  );
}

interface StepsProps {
  steps: OnboardingStep[];
  onBack: () => void;
  onGo: (target: StepTarget) => void;
}

/** Submenu: lista dos primeiros passos, um card por passo. */
function StepsScreen({ steps, onBack, onGo }: StepsProps) {
  const colors = useColors();
  const styles = useStyles();
  const doneCount = steps.filter(s => s.done).length;
  return (
    <Page>
      <SubHeader title={t('Primeiros passos')} onBack={onBack} />
      <Card>
        <View style={styles.rowBetween}>
          <CardText>
            {doneCount === steps.length ? t('Tudo pronto!') : t('{doneCount} de {length} concluídos', { doneCount, length: steps.length })}
          </CardText>
        </View>
        <ProgressBar value={doneCount / steps.length} />
      </Card>
      {steps.map(step => (
        <Card key={step.id}>
          <View style={styles.cardHead}>
            <IconTile name={step.icon} size={40} color={step.done ? colors.successText : undefined} />
            <View style={styles.flex}>
              <Text style={[styles.stepTitle, step.done && styles.stepTitleDone]}>{step.title}</Text>
              <Text style={styles.stepText}>{step.description}</Text>
            </View>
          </View>
          {step.done ? (
            <StatusChip done label={t('Concluído')} />
          ) : (
            <Button testID={`step-${step.id}`} label={step.actionLabel} variant="secondary" onPress={() => onGo(step.target)} />
          )}
        </Card>
      ))}
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  grid: { gap: spacing.xl, paddingTop: spacing.sm },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, alignItems: 'center' },
  editDock: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  editDockText: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
  flex: { flex: 1, gap: spacing.xs },
  flexOnly: { flex: 1 },
  subHeaderBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepTitleDone: { color: colors.textMuted },
  stepText: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
}));
