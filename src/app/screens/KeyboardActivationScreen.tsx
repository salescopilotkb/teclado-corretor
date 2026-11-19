/**
 * Tela que abre logo depois do tutorial: ativar o teclado antes de entrar no app.
 * Mostra só os passos do celular em uso (iPhone ou Android) e confere sozinha quando
 * deu certo. "Fazer depois" entra no app do mesmo jeito (o passo continua no Início).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../i18n';
import { IconTile } from '../../keyboard/components/Icon';
import { makeStyles, spacing, typography } from '../../keyboard/theme';
import { useAppBack } from '../../navigation/back';
import { Repo } from '../../storage/storage';
import { Button } from '../components/ui';
import { MANUAL_STEPS } from '../onboarding/steps';
import { IS_IOS, KeyboardActivationSteps, useKeyboardStatus } from './KeyboardSetupScreen';

export function KeyboardActivationScreen({ onFinish }: { onFinish: () => void }) {
  const styles = useStyles();
  // Relê a cada segundo: o seletor do Android abre por cima do app, e no iPhone o
  // teclado avisa quando abre no campo de teste
  const status = useKeyboardStatus(1000);
  const ready = IS_IOS ? status.enabled === true : status.selected === true;
  const [confirmedByUser, setConfirmedByUser] = useState(false);
  // "Voltar" do celular: o mesmo que "Fazer depois"
  useAppBack(onFinish);

  const confirm = () => {
    Repo.markStepDone(MANUAL_STEPS.keyboard);
    setConfirmedByUser(true);
  };

  if (ready || confirmedByUser) {
    return (
      <View style={styles.root} testID="keyboard-activation-done">
        <View style={styles.center}>
          <IconTile name="check" size={96} />
          <Text style={styles.title}>{t('Teclado ativado!')}</Text>
          <Text style={styles.lead}>
            {t('Na conversa, toque no ícone de teclado no topo do KEYCON para alternar entre as letras e as suas ferramentas de venda.')}
          </Text>
        </View>
        <Button testID="activation-finish" label={t('Começar a usar')} onPress={onFinish} />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="keyboard-activation">
      <View style={styles.top}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onFinish} testID="activation-later">
          <Text style={styles.skip}>{t('Fazer depois')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconTile name="teclado" size={72} />
          <Text style={styles.title}>{t('Ative o teclado KEYCON')}</Text>
          <Text style={styles.lead}>
            {IS_IOS
              ? t('Leva menos de um minuto, e é só uma vez. Depois, o KEYCON aparece em qualquer conversa.')
              : t('São só dois toques, e é só uma vez. Depois, o KEYCON aparece em qualquer conversa.')}
          </Text>
        </View>
        <KeyboardActivationSteps status={status} />
        {/* iPhone: se o teste não confirmar sozinho (ex.: sem o Acesso Total), a pessoa confirma */}
        {IS_IOS && <Button label={t('Já ativei o teclado')} variant="secondary" icon="check" onPress={confirm} />}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg },
  top: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', minHeight: 44 },
  skip: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  scroll: { gap: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  lead: { ...typography.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
}));
