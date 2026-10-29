import { t } from '../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { Repo, storage } from '../../storage/storage';
import { glassBorder, makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Button, Card, CardText, CardTitle, Page, StatusChip, SubHeader } from '../components/ui';
import { MANUAL_STEPS } from '../onboarding/steps';

export interface KeyboardStatus {
  /** null = o sistema não informa (iPhone e web). */
  enabled: boolean | null;
  selected: boolean | null;
}

const STATUS_KEY_ENABLED = 'keyboard.status.enabled';
const STATUS_KEY_SELECTED = 'keyboard.status.selected';

function getInitialKeyboardStatus(): KeyboardStatus {
  if (Platform.OS !== 'android') return { enabled: null, selected: null };
  const hasEnabled = storage.contains(STATUS_KEY_ENABLED);
  const hasSelected = storage.contains(STATUS_KEY_SELECTED);
  if (hasEnabled || hasSelected) {
    return {
      enabled: hasEnabled ? (storage.getBoolean(STATUS_KEY_ENABLED) ?? null) : null,
      selected: hasSelected ? (storage.getBoolean(STATUS_KEY_SELECTED) ?? null) : null,
    };
  }
  return { enabled: null, selected: null };
}

let cachedStatus: KeyboardStatus = getInitialKeyboardStatus();

/** Situação do teclado no Android, relida sempre que o app volta à tela. */
export function useKeyboardStatus(): KeyboardStatus {
  const [status, setStatus] = useState<KeyboardStatus>(cachedStatus);

  const check = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const [enabled, selected] = await Promise.all([
        KeyboardBridge.isKeyboardEnabled(),
        KeyboardBridge.isKeyboardSelected(),
      ]);
      const next: KeyboardStatus = { enabled, selected };
      cachedStatus = next;
      storage.set(STATUS_KEY_ENABLED, enabled);
      storage.set(STATUS_KEY_SELECTED, selected);
      if (enabled) {
        Repo.markStepDone(MANUAL_STEPS.keyboard);
      }
      setStatus(prev => (prev.enabled === next.enabled && prev.selected === next.selected ? prev : next));
    } catch {
      // Sem resposta do sistema: mantém o que sabia
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => s === 'active' && check());
    return () => sub.remove();
  }, [check]);

  return status;
}

function openKeyboardSettings() {
  if (Platform.OS === 'android') {
    KeyboardBridge.openKeyboardSettings().catch(() => {
      Linking.sendIntent('android.settings.INPUT_METHOD_SETTINGS').catch(() => Linking.openSettings());
    });
  } else {
    Linking.openSettings();
  }
}

interface StepProps {
  n: number;
  title: string;
  text: string;
  done?: boolean;
  children?: React.ReactNode;
}

function Step({ n, title, text, done, children }: StepProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, done && styles.stepNumDone]}>
        <Text style={[styles.stepNumText, done && { color: colors.successText }]}>{done ? '✓' : n}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
        {children}
      </View>
    </View>
  );
}

/** Submenu do Início: ativar o teclado no Android ou no iPhone. */
export function KeyboardSetupScreen({ onBack }: { onBack: () => void }) {
  const styles = useStyles();
  const { enabled, selected } = useKeyboardStatus();
  const [platform, setPlatform] = useState<'android' | 'ios'>(Platform.OS === 'ios' ? 'ios' : 'android');
  const [confirmed, setConfirmed] = useState(() => Repo.getStepsDone().includes(MANUAL_STEPS.keyboard));

  const ready = selected === true || (enabled === null && confirmed);
  const confirm = () => {
    Repo.markStepDone(MANUAL_STEPS.keyboard);
    setConfirmed(true);
  };

  return (
    <Page>
      <SubHeader title={t('Ativar o teclado')} onBack={onBack} />

      <Card>
        <StatusChip
          done={ready}
          label={ready ? t('Teclado ativo') : enabled ? t('Falta selecionar o KEYCON') : t('Teclado não ativado')}
        />
        <CardText>{t('Dois passos rápidos para usar o KEYCON no WhatsApp e em qualquer app.')}</CardText>
      </Card>

      <View style={styles.segmented}>
        {(['android', 'ios'] as const).map(p => (
          <Pressable
            key={p}
            accessibilityRole="tab"
            accessibilityState={{ selected: platform === p }}
            style={[styles.segment, platform === p && styles.segmentActive]}
            onPress={() => setPlatform(p)}>
            <Text style={[styles.segmentText, platform === p && styles.segmentTextActive]}>
              {p === 'android' ? t('Android') : t('iPhone')}
            </Text>
          </Pressable>
        ))}
      </View>

      {platform === 'android' ? (
        <Card>
          <Step n={1} title={t('Habilitar')} text={t('Ligue a chave do KEYCON na lista de teclados.')} done={enabled === true}>
            <Button label={t('Abrir configurações')} variant={enabled ? 'secondary' : 'primary'} onPress={openKeyboardSettings} />
          </Step>
          <Step n={2} title={t('Selecionar')} text={t('Escolha o KEYCON como teclado atual.')} done={selected === true}>
            <Button
              label={t('Escolher teclado')}
              variant={enabled && !selected ? 'primary' : 'secondary'}
              onPress={() => KeyboardBridge.openInputMethodPicker()}
            />
          </Step>
          <Step n={3} title={t('No dia a dia')} text={t('Troque de teclado pelo ícone de teclado na barra do Android.')} />
        </Card>
      ) : (
        <Card>
          <Step n={1} title={t('Adicionar')} text={t('Ajustes › Geral › Teclado › Teclados › Adicionar Novo Teclado › KEYCON.')} />
          <Step n={2} title={t('Acesso Total')} text={t('Toque em KEYCON e ative Permitir Acesso Total (fotos e IA precisam).')} />
          <Step n={3} title={t('No dia a dia')} text={t('Toque e segure o globo 🌐 no teclado e escolha o KEYCON.')} />
          <Button label={t('Abrir Ajustes')} onPress={openKeyboardSettings} />
        </Card>
      )}

      {/* Sem como checar no iPhone/web: o usuário confirma */}
      {enabled === null && !confirmed && <Button label={t('Já ativei o teclado')} variant="secondary" icon="check" onPress={confirm} />}
    </Page>
  );
}

/** Submenu do Início: campo para testar o teclado. */
export function KeyboardTestScreen({ onBack }: { onBack: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [text, setText] = useState('');
  return (
    <Page>
      <SubHeader title={t('Testar o teclado')} onBack={onBack} />
      <Card>
        <CardTitle>{t('Digite aqui')}</CardTitle>
        <CardText>{t('Escolha o KEYCON no teclado e repare nas sugestões acima das teclas.')}</CardText>
        <TextInput
          testID="keyboard-test-input"
          style={styles.testInput}
          placeholder={t('Toque para abrir o teclado')}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={t => {
            setText(t);
            if (t.trim().length >= 3) Repo.markStepDone(MANUAL_STEPS.test);
          }}
          multiline
        />
        {text ? <Button label={t('Limpar')} variant="secondary" onPress={() => setText('')} /> : null}
      </Card>
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
  },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.primarySoft },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  segmentTextActive: { color: colors.primaryText, fontWeight: '600' },
  step: { flexDirection: 'row', gap: spacing.md },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumDone: { backgroundColor: colors.successBg },
  stepNumText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
  stepBody: { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepText: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: -4 },
  testInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
    ...typography.body,
  },
}));
