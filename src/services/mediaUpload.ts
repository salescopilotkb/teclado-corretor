import { t } from '../i18n';
/**
 * Envio de fotos, vídeos e áudios para o Storage do Supabase (bucket "media").
 *
 * Cada usuário grava só na própria pasta (media/<id do usuário>/...), como
 * manda a regra do supabase/schema.sql. O bucket é público para leitura: o
 * link do arquivo é o que o teclado baixa e entrega na conversa.
 *
 * O envio usa XMLHttpRequest (e não o cliente do Supabase) para ter o
 * progresso e mandar o arquivo direto do disco, sem carregar tudo na memória.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase';
import { supabase } from './supabase';
import { DEMO_MODE } from '../config/demo';

/** Mesmo limite do bucket e do teclado. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const BUCKET = 'media';

/** Arquivo escolhido ou gravado no aparelho. */
export interface LocalMedia {
  /** file:// ou content:// (no celular); blob: (na versão web). */
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  durationMs?: number;
  /** Só na versão web: o próprio arquivo. */
  file?: Blob;
}

export interface UploadedMedia {
  url: string;
  storagePath: string;
  /** Locker (R2): o link é temporário e vale até aqui (ms). */
  expiresAt?: number;
  mime?: string;
  size?: number;
}

export class UploadError extends Error {}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/amr': 'amr',
};

function extensionFor(media: LocalMedia): string {
  const fromType = EXTENSION_BY_TYPE[media.mimeType.toLowerCase()];
  if (fromType) return fromType;
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(media.name)?.[1];
  return (fromName ?? 'bin').toLowerCase();
}

/** Nome aleatório: o link é público, então não dá para adivinhar outros arquivos. */
function randomName(): string {
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

export function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * Envia o arquivo e devolve o link público. `onProgress` recebe de 0 a 1.
 * Erros chegam como UploadError com mensagem pronta para o usuário.
 */
export async function uploadMedia(media: LocalMedia, onProgress?: (fraction: number) => void): Promise<UploadedMedia> {
  if (DEMO_MODE) {
    // Demonstração (versão web): o arquivo fica só nesta aba do navegador, nada vai ao servidor
    onProgress?.(1);
    return { url: media.uri, storagePath: '' };
  }
  if (media.size && media.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(t('O arquivo passa de 50 MB. Escolha um menor ou mande o link.'));
  }
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new UploadError(t('Sessão expirada. Entre na conta de novo para enviar arquivos.'));

  const storagePath = `${session.user.id}/${randomName()}.${extensionFor(media)}`;
  const body = new FormData();
  if (media.file) {
    // Web: Blob com nome de arquivo (assinatura de 3 argumentos do navegador)
    (body as unknown as { append(name: string, value: Blob, fileName: string): void }).append('file', media.file, media.name);
  } else {
    // React Native: o arquivo vai direto do disco
    body.append('file', { uri: media.uri, name: media.name, type: media.mimeType } as unknown as Blob);
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(new UploadError(uploadErrorMessage(xhr.status, xhr.responseText)));
    };
    xhr.onerror = () => reject(new UploadError(t('Sem conexão com a internet. Verifique e tente de novo.')));
    xhr.ontimeout = () => reject(new UploadError(t('O envio demorou demais. Tente de novo com uma conexão melhor.')));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(body);
  });

  return { url: publicUrl(storagePath), storagePath };
}

function uploadErrorMessage(status: number, response: string): string {
  const text = response.toLowerCase();
  if (status === 413 || text.includes('payload too large') || text.includes('exceeded the maximum')) {
    return t('O arquivo passa do limite de 50 MB.');
  }
  if (text.includes('bucket not found')) {
    return t('O armazenamento de arquivos ainda não foi criado. Rode o arquivo supabase/schema.sql no Supabase.');
  }
  if (status === 401 || status === 403) return t('Sem permissão para enviar. Entre na conta de novo.');
  return t('Não foi possível enviar o arquivo (erro {status}).', { status });
}

/**
 * Apaga um arquivo enviado pelo app (links externos ficam como estão): do Locker
 * no Cloudflare R2 ("r2:<caminho>", pela Edge Function "locker") ou do bucket "media".
 */
export async function deleteUploadedMedia(storagePath: string | undefined): Promise<void> {
  if (!storagePath) return;
  try {
    if (storagePath.startsWith('r2:')) {
      await supabase.functions.invoke('locker', { body: { action: 'delete', keys: [storagePath.slice(3)] } });
      return;
    }
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    // Sem internet: o arquivo fica órfão no Storage, sem afetar o app
  }
}

/** "1:05" a partir de milissegundos. */
export function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
