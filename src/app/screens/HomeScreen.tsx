/**
 * Início — painel principal do app.
 * Poucos cards na primeira tela (teclado, primeiros passos, atalhos para as
 * outras áreas); o detalhe de cada assunto fica num submenu.
 */
import { t } from '../../i18n';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { IconTile } from '../../keyboard/components/Icon';
import { makeStyles, spacing, useColors } from '../../keyboard/theme';
import { getSegment } from '../../segments/segments';
import { Repo } from '../../storage/storage';
import { LOCKER_NAME } from '../../files/files';
import {
  Button,
  Card,
  CardText,
  CardTitle,
  MenuGroup,
  MenuRow,
  Page,
  ProgressBar,
  ScreenTitle,
  StatusChip,
  SubHeader,
} from '../components/ui';
import { buildSteps } from '../onboarding/steps';
import type { OnboardingStep, StepTarget } from '../onboarding/steps';
import { KeyboardSetupScreen, KeyboardTestScreen, useKeyboardStatus } from './KeyboardSetupScreen';
import { ShortcutsManagerScreen } from './ShortcutsManagerScreen';

type HomeSection = 'root' | 'install' | 'steps' | 'test' | 'shortcuts';

/** Destinos fora do Início (outras abas do app). */
export type AppTarget = Extract<StepTarget, 'account-data' | 'catalog'> | 'files';

interface Props {
  onNavigate: (target: AppTarget) => void;
  onOpenTutorial: () => void;
}

export function HomeScreen({ onNavigate, onOpenTutorial }: Props) {
  const styles = useStyles();
  const [section, setSection] = useState<HomeSection>('root');
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

  // Recalculado a cada volta ao Início (os submenus podem ter concluído passos)
  const steps = buildSteps(segment, keyboard.enabled);
  if (section === 'steps') return <StepsScreen steps={steps} onBack={back} onGo={go} />;

  return (
    <HomeRoot
      steps={steps}
      keyboardReady={keyboard.selected === true || (keyboard.selected === null && steps[0].done)}
      keyboardHalfway={keyboard.enabled === true && keyboard.selected === false}
      onSection={setSection}
      onNavigate={onNavigate}
      onOpenTutorial={onOpenTutorial}
    />
  );
}

interface RootProps {
  steps: OnboardingStep[];
  keyboardReady: boolean;
  keyboardHalfway: boolean;
  onSection: (s: HomeSection) => void;
  onNavigate: (target: AppTarget) => void;
  onOpenTutorial: () => void;
}

function HomeRoot({ steps, keyboardReady, keyboardHalfway, onSection, onNavigate, onOpenTutorial }: RootProps) {
  const styles = useStyles();
  const seller = Repo.getSeller();
  const segment = getSegment(seller.segment);
  const folders = Repo.getFolders();
  const itemCount = folders.reduce((n, f) => n + f.products.length, 0);
  const shortcuts = Repo.getShortcuts();
  const shortcutCount = shortcuts.texts.length + shortcuts.audios.length + shortcuts.links.length;
  const files = Repo.getFiles();

  const doneCount = steps.filter(s => s.done).length;
  const nextStep = steps.find(s => !s.done);
  const firstName = seller.name.trim().split(/\s+/)[0];

  return (
    <Page>
      <ScreenTitle
        overline={seller.business || segment.label}
        title={firstName ? t('Olá, {firstName}', { firstName }) : t('Olá!')}
      />

      {/* Teclado: o essencial para tudo funcionar */}
      <Card>
        <View style={styles.cardHead}>
          <IconTile name="teclado" size={44} />
          <View style={styles.flex}>
            <CardTitle>{t('Teclado KEYCON')}</CardTitle>
            <StatusChip
              done={keyboardReady}
              label={keyboardReady ? t('Ativo') : keyboardHalfway ? t('Falta selecionar') : t('Não ativado')}
            />
          </View>
        </View>
        {keyboardReady ? (
          <Button label={t('Testar o teclado')} variant="secondary" onPress={() => onSection('test')} />
        ) : (
          <Button testID="home-activate" label={t('Ativar o teclado')} onPress={() => onSection('install')} />
        )}
      </Card>

      {/* Primeiros passos: some quando tudo estiver feito */}
      {nextStep && (
        <Card>
          <View style={styles.rowBetween}>
            <CardTitle>{t('Primeiros passos')}</CardTitle>
            <Text style={styles.count}>
              {t('{doneCount} de {length}', { doneCount, length: steps.length })}
            </Text>
          </View>
          <ProgressBar value={doneCount / steps.length} />
          <CardText>{t('Próximo: {title}.', { title: nextStep.title.toLowerCase() })}</CardText>
          <Button testID="home-steps" label={t('Continuar')} onPress={() => onSection('steps')} />
        </Card>
      )}

      <MenuGroup>
        <MenuRow
          icon="arquivos"
          title={segment.terms.catalog}
          subtitle={folders.length === 1 ? t('1 pasta') : t('{n} pastas', { n: folders.length })}
          value={`${itemCount}`}
          onPress={() => onNavigate('catalog')}
        />
        <MenuRow
          icon="atalhos"
          title={t('Atalhos')}
          subtitle={t('Textos, áudios e links prontos')}
          value={`${shortcutCount}`}
          onPress={() => onSection('shortcuts')}
        />
        <MenuRow
          testID="home-files"
          icon="galeria"
          title={LOCKER_NAME}
          subtitle={t('Pastas com fotos e vídeos')}
          value={`${files.files.length}`}
          onPress={() => onNavigate('files')}
        />
        <MenuRow icon="teclado" title={t('Instalação do teclado')} subtitle={t('Android e iPhone')} onPress={() => onSection('install')} />
        <MenuRow testID="home-tutorial" icon="info" title={t('Tutorial do app')} subtitle={t('Tudo o que dá para fazer')} onPress={onOpenTutorial} />
      </MenuGroup>
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
  flex: { flex: 1, gap: spacing.xs },
  flexOnly: { flex: 1 },
  subHeaderBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '600', color: colors.primaryText },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepTitleDone: { color: colors.textMuted },
  stepText: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
}));
