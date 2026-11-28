/**
 * Escolher ou capturar mídia no app: fotos e vídeos (câmera ou galeria) e
 * arquivos de áudio. Devolve o arquivo local pronto para o uploadMedia.
 *
 * A câmera é a do próprio celular (sem pedir a permissão de câmera ao KEYCON).
 * Na galeria, o Android 13+ usa o seletor de fotos do sistema, sem pedir
 * acesso a todas as fotos.
 */
import { t } from '../i18n';
import { Platform } from 'react-native';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, ImagePickerResponse } from 'react-native-image-picker';
import type { LocalMedia } from '../services/mediaUpload';
import { lockerSizeError, MAX_PICK_BYTES } from '../files/limits';
import { getPlan } from '../plans/plan';

export type MediaKind = 'image' | 'video';

export class PickError extends Error {}

/** Fotos saem em JPEG, no máximo 2048 px: leves para enviar e o WhatsApp aceita direto. */
const PHOTO_OPTIONS = { mediaType: 'photo', quality: 0.8, maxWidth: 2048, maxHeight: 2048 } as const;
const VIDEO_OPTIONS = { mediaType: 'video', videoQuality: 'high', durationLimit: 180, formatAsMp4: true } as const;

function toLocal(asset: Asset, kind: MediaKind): LocalMedia {
  if (!asset.uri) throw new PickError(t('O arquivo escolhido não pôde ser lido.'));
  const fallbackType = kind === 'image' ? 'image/jpeg' : 'video/mp4';
  return {
    uri: asset.uri,
    name: asset.fileName ?? `${kind === 'image' ? 'foto' : 'video'}-${Date.now()}`,
    mimeType: asset.type ?? fallbackType,
    size: asset.fileSize,
    // O picker informa a duração do vídeo em segundos
    durationMs: asset.duration ? asset.duration * 1000 : undefined,
  };
}

function handle(response: ImagePickerResponse, kind: MediaKind): LocalMedia | null {
  if (response.didCancel) return null;
  if (response.errorCode === 'camera_unavailable') throw new PickError(t('Este aparelho não tem câmera disponível.'));
  if (response.errorCode === 'permission') throw new PickError(t('Sem permissão para usar a câmera ou as fotos.'));
  if (response.errorCode) throw new PickError(response.errorMessage || t('Não foi possível abrir a câmera ou a galeria.'));
  const asset = response.assets?.[0];
  if (!asset) return null;
  const media = toLocal(asset, kind);
  // O teto é o maior tipo do plano (Plus e Pro aceitam vídeos maiores); o tipo certo confere no envio
  const limits = getPlan().limits;
  const ceiling = Math.max(MAX_PICK_BYTES, limits.maxVideoBytes ?? 0);
  if (media.size && media.size > ceiling) {
    throw new PickError(lockerSizeError('video/mp4', media.size, limits) ?? t('O arquivo passa de 64 MB. Grave um vídeo mais curto ou mande o link.'));
  }
  return media;
}

/** Galeria (fotos ou vídeos). null = a pessoa cancelou. */
export async function pickFromGallery(kind: MediaKind): Promise<LocalMedia | null> {
  const response = await launchImageLibrary({ ...(kind === 'image' ? PHOTO_OPTIONS : VIDEO_OPTIONS), selectionLimit: 1 });
  return handle(response, kind);
}

/** Galeria com fotos e vídeos juntos (seção Arquivos). null = cancelou. */
export async function pickPhotoOrVideo(): Promise<LocalMedia | null> {
  const response = await launchImageLibrary({
    ...PHOTO_OPTIONS,
    mediaType: 'mixed',
    videoQuality: 'high',
    formatAsMp4: true,
    selectionLimit: 1,
  });
  const type = response.assets?.[0]?.type ?? '';
  return handle(response, type.startsWith('video/') ? 'video' : 'image');
}

/** Câmera do celular: tira a foto ou grava o vídeo. null = cancelou. */
export async function captureWithCamera(kind: MediaKind): Promise<LocalMedia | null> {
  const response = await launchCamera({ ...(kind === 'image' ? PHOTO_OPTIONS : VIDEO_OPTIONS), saveToPhotos: false });
  return handle(response, kind);
}

/** Arquivo escolhido e copiado para o cache do app. */
interface PickedFile {
  uri: string;
  name: string | null;
  type: string | null;
  size: number | null;
}

/**
 * Abre o seletor de arquivos do sistema e guarda uma cópia no cache do app: o link
 * content:// de outro app pode expirar antes do envio. null = a pessoa cancelou.
 */
async function pickOne(type: string[], fallbackName: string): Promise<PickedFile | null> {
  try {
    const [file] = await pick({ type, mode: 'import' });
    if (!file || file.error) throw new PickError(t('Não foi possível ler o arquivo escolhido.'));
    const name = file.name ?? fallbackName;
    const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: name }], destination: 'cachesDirectory' });
    if (copy.status !== 'success') throw new PickError(t('Não foi possível ler o arquivo escolhido.'));
    return { uri: copy.localUri, name: file.name, type: file.type, size: file.size };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    if (e instanceof PickError) throw e;
    throw new PickError(t('Não foi possível abrir os arquivos do celular.'));
  }
}

/** Arquivo de áudio do celular (mp3, m4a, ogg, wav...). null = cancelou. */
export async function pickAudioFile(): Promise<LocalMedia | null> {
  const file = await pickOne([types.audio], `audio-${Date.now()}`);
  if (!file) return null;
  if (file.size && file.size > MAX_PICK_BYTES) throw new PickError(t('O áudio passa de 64 MB.'));
  return {
    uri: file.uri,
    name: file.name ?? `audio-${Date.now()}`,
    mimeType: file.type ?? 'audio/mpeg',
    size: file.size ?? undefined,
  };
}

/** Documentos do celular: PDF, Word, Excel, PowerPoint, TXT, CSV e outros. null = cancelou. */
export async function pickDocument(): Promise<LocalMedia | null> {
  const file = await pickOne(
    [
      types.pdf,
      types.doc,
      types.docx,
      types.xls,
      types.xlsx,
      types.ppt,
      types.pptx,
      types.plainText,
      ...types.csv,
      // Qualquer outro documento (ODT, RTF, Pages, Numbers, ZIP...)
      ...(Platform.OS === 'ios' ? ['public.content', 'public.data'] : ['application/*', 'text/*']),
    ],
    `documento-${Date.now()}`,
  );
  if (!file) return null;
  const mimeType = file.type || mimeFromName(file.name) || 'application/octet-stream';
  const media: LocalMedia = {
    uri: file.uri,
    name: file.name ?? `documento-${Date.now()}`,
    mimeType,
    size: file.size ?? undefined,
  };
  const tooBig = media.size ? lockerSizeError(mimeType, media.size, getPlan().limits) : null;
  if (tooBig) throw new PickError(tooBig);
  return media;
}

/** Tipo pela extensão, quando o sistema não informa (comum em .docx e .txt). */
function mimeFromName(name: string | null): string | undefined {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name ?? '')?.[1]?.toLowerCase();
  return ext ? DOC_TYPES[ext] : undefined;
}

const DOC_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

/** A câmera existe nesta plataforma (na web de testes, não). */
export const canUseCamera = true;
