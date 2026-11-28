import { t } from '../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Text, TextInput, View } from 'react-native';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { IOS_SIMULATION } from '../../native/platformSim';
import { Repo, storage } from '../../storage/storage';
import { makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Button, Card, CardText, CardTitle, Page, StatusChip, SubHeader } from '../components/ui';
import { MANUAL_STEPS } from '../onboarding/steps';

export interface KeyboardStatus {
  /** null = o sistema não informa (iPhone e web, antes de o teclado abrir uma vez). */
  enabled: boolean | null;
  selected: boolean | null;
}

/** Passos do iPhone ou do Android: o de cada celular (na web, "?ios" mostra os do iPhone). */
export const IS_IOS = Platform.OS === 'ios' || (Platform.OS === 'web' && IOS_SIMULATION);

const STATUS_KEY_ENABLED = 'keyboard.status.enabled';
const STATUS_KEY_SELECTED = 'keyboard.status.selected';

/** iPhone e web: o teclado grava quando abre (Repo.markKeyboardSeen); sem isso, não se sabe. */
function seenStatus(): KeyboardStatus {
  return { enabled: Repo.getKeyboardSeenAt() > 0 ? true : null, selected: null };
}

function getInitialKeyboardStatus(): KeyboardStatus {
  if (Platform.OS !== 'android') return seenStatus();
  const hasEnabled = storage.contains(STATUS_KEY_ENABLED);
  const hasSelected = storage.contains(STATUS_KEY_SELECTED);
  return {
    enabled: hasEnabled ? (storage.getBoolean(STATUS_KEY_ENABLED) ?? null) : null,
    selected: hasSelected ? (storage.getBoolean(STATUS_KEY_SELECTED) ?? null) : null,
  };
}

let cachedStatus: KeyboardStatus = getInitialKeyboardStatus();

/** O teclado já está pronto para usar (pelo que o app sabe agora)? */
export function isKeyboardReadyNow(): boolean {
  if (Platform.OS === 'android') return cachedStatus.selected === true;
  return Repo.getKeyboardSeenAt() > 0 || Repo.getStepsDone().includes(MANUAL_STEPS.keyboard);
}

/**
 * Situação do teclado, relida sempre que o app volta à tela. `pollMs` relê também
 * de tempos em tempos (o seletor de teclados do Android abre por cima do app, sem
 * ele sair da tela; no iPhone, o teclado avisa quando abre no campo de teste).
 */
export function useKeyboardStatus(pollMs = 0): KeyboardStatus {
  const [status, setStatus] = useState<KeyboardStatus>(cachedStatus);

  const check = useCallback(async () => {
    let next: KeyboardStatus;
    if (Platform.OS !== 'android') {
      next = seenStatus();
    } else {
      try {
        const [enabled, selected] = await Promise.all([KeyboardBridge.isKeyboardEnabled(), KeyboardBridge.isKeyboardSelected()]);
        next = { enabled, selected };
        storage.set(STATUS_KEY_ENABLED, enabled);
        storage.set(STATUS_KEY_SELECTED, selected);
      } catch {
        return; // sem resposta do sistema: mantém o que sabia
      }
    }
    cachedStatus = next;
    if (next.enabled) Repo.markStepDone(MANUAL_STEPS.keyboard);
    setStatus(prev => (prev.enabled === next.enabled && prev.selected === next.selected ? prev : next));
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => s === 'active' && check());
    const timer = pollMs > 0 ? setInterval(check, pollMs) : null;
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [check, pollMs]);

  return status;
}

/** Android: lista de teclados. iPhone: Ajustes › KEYCON (onde fica "Teclados"). */
function openKeyboardSettings() {
  if (Platform.OS === 'android') {
    KeyboardBridge.openKeyboardSettings().catch(() => {
      Linking.sendIntent('android.settings.INPUT_METHOD_SETTINGS').catch(() => Linking.openSettings());
    });
  } else {
    Linking.openSettings().catch(() => {});
  }
}

interface StepProps {
  n: number;
  title: string;
  text?: string;
  done?: boolean;
  /** O passo da vez fica em destaque; os outros, mais apagados. */
  current?: boolean;
  children?: React.ReactNode;
}

function Step({ n, title, text, done, current, children }: StepProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.step, !current && !done && styles.stepIdle]}>
      <View style={[styles.stepNum, done && styles.stepNumDone, current && styles.stepNumCurrent]}>
        <Text style={[styles.stepNumText, done && { color: colors.successText }, current && { color: colors.onPrimary }]}>
          {done ? '✓' : n}
        </Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{title}</Text>
        {text ? <Text style={styles.stepText}>{text}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Campo para abrir o teclado e conferir (no iPhone, é assim que o app descobre que deu certo). */
function TryField({ placeholder }: { placeholder: string }) {
  const colors = useColors();
  const styles = useStyles();
  const [text, setText] = useState('');
  return (
    <TextInput
      testID="keyboard-try-input"
      style={styles.tryInput}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      value={text}
      onChangeText={setText}
    />
  );
}

/**
 * Os passos para ativar o teclado, só os do celular em uso. Usado na tela que abre
 * depois do tutorial e em Início › Instalação do teclado.
 */
export function KeyboardActivationSteps({ status }: { status: KeyboardStatus }) {
  const { enabled, selected } = status;
  if (!IS_IOS) {
    const step = enabled !== true ? 1 : selected !== true ? 2 : 3;
    return (
      <Card>
        <Step
          n={1}
          title={t('Ligue o KEYCON')}
          text={t('Na lista de teclados, ligue a chave do KEYCON. O Android mostra um aviso que aparece para qualquer teclado: toque em OK.')}
          done={enabled === true}
          current={step === 1}>
          {step === 1 && <Button testID="activation-open-settings" label={t('Abrir configurações')} onPress={openKeyboardSettings} />}
        </Step>
        <Step
          n={2}
          title={t('Escolha o KEYCON')}
          text={t('Na janela que abrir, toque em KEYCON.')}
          done={selected === true}
          current={step === 2}>
          {step === 2 && (
            <Button testID="activation-pick" label={t('Escolher teclado')} onPress={() => KeyboardBridge.openInputMethodPicker()} />
          )}
        </Step>
      </Card>
    );
  }

  const ready = enabled === true;
  return (
    <Card>
      <Step n={1} title={t('Abra os Ajustes do KEYCON')} done={ready} current={!ready}>
        {!ready && <Button testID="activation-open-settings" label={t('Abrir Ajustes')} onPress={openKeyboardSettings} />}
      </Step>
      <Step n={2} title={t('Toque em Teclados')} done={ready} current={!ready} />
      <Step
        n={3}
        title={t('Ligue KEYCON e Permitir Acesso Total')}
        text={t('O Acesso Total deixa o teclado usar seus produtos, fotos e clientes. O KEYCON não guarda o que você digita.')}
        done={ready}
        current={!ready}
      />
      <Step
        n={4}
        title={t('Volte aqui e teste')}
        text={t('Toque no campo, segure o globo 🌐 no teclado e escolha KEYCON.')}
        done={ready}
        current={!ready}>
        {!ready && <TryField placeholder={t('Toque aqui para testar')} />}
      </Step>
    </Card>
  );
}

/** Submenu do Início: ativar o teclado (os passos do celular em uso). */
export function KeyboardSetupScreen({ onBack }: { onBack: () => void }) {
  const status = useKeyboardStatus(1500);
  const [confirmed, setConfirmed] = useState(() => Repo.getStepsDone().includes(MANUAL_STEPS.keyboard));
  const ready = status.selected === true || (status.selected === null && (status.enabled === true || confirmed));
  const halfway = status.enabled === true && status.selected === false;
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
          label={ready ? t('Teclado ativo') : halfway ? t('Falta selecionar o KEYCON') : t('Teclado não ativado')}
        />
        <CardText>
          {ready
            ? t('Tudo certo. Na conversa, toque no ícone de teclado no topo do KEYCON para alternar entre as letras e as suas ferramentas de venda.')
            : t('Leva menos de um minuto, e é só uma vez.')}
        </CardText>
      </Card>
      {!ready && <KeyboardActivationSteps status={status} />}
      {/* iPhone: se o teste não confirmar sozinho, a pessoa confirma */}
      {IS_IOS && !ready && <Button label={t('Já ativei o teclado')} variant="secondary" icon="check" onPress={confirm} />}
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
  step: { flexDirection: 'row', gap: spacing.md },
  stepIdle: { opacity: 0.55 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumCurrent: { backgroundColor: colors.primary },
  stepNumDone: { backgroundColor: colors.successBg },
  stepNumText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
  stepBody: { flex: 1, gap: spacing.sm, paddingTop: 3 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepTitleDone: { color: colors.textMuted },
  stepText: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: -4 },
  tryInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    ...typography.body,
  },
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
