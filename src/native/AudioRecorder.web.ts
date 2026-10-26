import { t } from '../i18n';
/**
 * AudioRecorder — versão WEB (site de testes): MediaRecorder do navegador.
 * Mesma API do AudioRecorder.ts. O navegador grava em WebM/Opus (ou MP4 no Safari).
 */
import type { LocalMedia } from '../services/mediaUpload';

export class RecorderError extends Error {}

const g = globalThis as { navigator?: any; MediaRecorder?: any };

export const canRecord = !!g.navigator?.mediaDevices?.getUserMedia && !!g.MediaRecorder;

let recorder: any = null;
let chunks: Blob[] = [];
let startedAt = 0;

/** Mesma assinatura do AudioRecorder.ts (no navegador o pedido do microfone é do próprio navegador). */
export async function startRecording(_options: { fromKeyboard?: boolean } = {}): Promise<void> {
  if (!canRecord) throw new RecorderError(t('Este navegador não grava áudio.'));
  let stream: any;
  try {
    stream = await g.navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new RecorderError(t('Sem permissão para usar o microfone.'));
  }
  chunks = [];
  recorder = new g.MediaRecorder(stream);
  recorder.ondataavailable = (e: { data: Blob }) => e.data.size && chunks.push(e.data);
  recorder.start();
  startedAt = Date.now();
}

export function stopRecording(): Promise<LocalMedia> {
  return new Promise((resolve, reject) => {
    if (!recorder) {
      reject(new RecorderError(t('Nenhuma gravação em andamento.')));
      return;
    }
    const current = recorder;
    current.onstop = () => {
      current.stream.getTracks().forEach((t: { stop(): void }) => t.stop());
      recorder = null;
      const type = (current.mimeType as string) || 'audio/webm';
      // (os tipos do React Native pedem lastModified; o navegador não)
      const file = new Blob(chunks, { type } as unknown as BlobOptions);
      const ext = type.includes('mp4') ? 'm4a' : 'webm';
      resolve({
        uri: URL.createObjectURL(file),
        name: `audio-${Date.now()}.${ext}`,
        mimeType: type.split(';')[0],
        size: file.size,
        durationMs: Date.now() - startedAt,
        file,
      });
    };
    current.stop();
  });
}

export async function cancelRecording(): Promise<void> {
  if (!recorder) return;
  const current = recorder;
  recorder = null;
  current.onstop = () => current.stream.getTracks().forEach((t: { stop(): void }) => t.stop());
  current.stop();
}
