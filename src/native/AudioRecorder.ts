/**
 * Gravador de áudio dos atalhos, no app e no teclado. No Android usa o módulo
 * nativo KeyconAudioRecorder (M4A/AAC); a permissão do microfone é pedida na
 * hora. No teclado não há Activity para o PermissionsAndroid: o pedido sai
 * pela tela invisível do KeyboardBridge (MediaPickActivity). No iPhone, o
 * KeyconAudioRecorder existe só no app (ios/CorretorKeyboard/KeyconAudioRecorder.m).
 */
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { KeyboardBridge } from './KeyboardBridge';
import type { LocalMedia } from '../services/mediaUpload';
import { t } from '../i18n';

interface RecorderNative {
  start(): Promise<boolean>;
  stop(): Promise<{ uri: string; name: string; mimeType: string; size: number; durationMs: number }>;
  cancel(): Promise<boolean>;
}

const Native: RecorderNative | undefined = NativeModules.KeyconAudioRecorder;

export class RecorderError extends Error {}

/**
 * Gravar está disponível aqui. No iPhone o gravador só existe no app (a Apple
 * proíbe microfone em teclados), então no teclado do iPhone isto é falso.
 */
export const canRecord = !!Native;

const BLOCKED_MESSAGE = 'O microfone está bloqueado para o KEYCON. Libere em Configurações › Apps › KEYCON › Permissões.';

async function ensureMicPermission(fromKeyboard: boolean): Promise<void> {
  // iPhone: o próprio gravador pede o microfone na primeira vez
  if (Platform.OS !== 'android') return;
  if (fromKeyboard) {
    const state = await KeyboardBridge.requestMicPermission();
    if (state === 'granted') return;
    throw new RecorderError(state === 'blocked' ? t(BLOCKED_MESSAGE) : t('Sem permissão para usar o microfone.'));
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: t('Gravar áudio'),
    message: t('O KEYCON usa o microfone só para gravar os seus atalhos de áudio.'),
    buttonPositive: 'Permitir',
    buttonNegative: 'Agora não',
  });
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new RecorderError(
      granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? t(BLOCKED_MESSAGE) : t('Sem permissão para usar o microfone.'),
    );
  }
}

/** `fromKeyboard`: gravando de dentro do teclado (a permissão é pedida pelo KeyboardBridge). */
export async function startRecording({ fromKeyboard = false }: { fromKeyboard?: boolean } = {}): Promise<void> {
  if (!Native) throw new RecorderError(t('No iPhone, grave o áudio pelo app KEYCON.'));
  await ensureMicPermission(fromKeyboard);
  try {
    await Native.start();
  } catch (e) {
    throw new RecorderError(e instanceof Error ? e.message : t('Não foi possível usar o microfone.'));
  }
}

export async function stopRecording(): Promise<LocalMedia> {
  if (!Native) throw new RecorderError(t('Nenhuma gravação em andamento.'));
  try {
    const r = await Native.stop();
    return { uri: r.uri, name: r.name, mimeType: r.mimeType, size: r.size, durationMs: r.durationMs };
  } catch (e) {
    throw new RecorderError(e instanceof Error ? e.message : t('Não foi possível terminar a gravação.'));
  }
}

export async function cancelRecording(): Promise<void> {
  await Native?.cancel().catch(() => {});
}
