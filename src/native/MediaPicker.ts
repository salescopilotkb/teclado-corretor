/**
 * Escolher ou capturar mídia no app: fotos e vídeos (câmera ou galeria) e
 * arquivos de áudio. Devolve o arquivo local pronto para o uploadMedia.
 *
 * A câmera é a do próprio celular (sem pedir a permissão de câmera ao KEYCON).
 * Na galeria, o Android 13+ usa o seletor de fotos do sistema, sem pedir
 * acesso a todas as fotos.
 */
import { t } from '../i18n';
import DocumentPicker from 'react-native-document-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Asset, ImagePickerResponse } from 'react-native-image-picker';
import type { LocalMedia } from '../services/mediaUpload';
import { MAX_PICK_BYTES } from '../files/limits';

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
  if (media.size && media.size > MAX_PICK_BYTES) {
    throw new PickError(t('O arquivo passa de 64 MB. Grave um vídeo mais curto ou mande o link.'));
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

/** Arquivo de áudio do celular (mp3, m4a, ogg, wav...). null = cancelou. */
export async function pickAudioFile(): Promise<LocalMedia | null> {
  try {
    // Cópia no cache do app: o link content:// de outro app pode expirar antes do envio
    const file = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.audio], copyTo: 'cachesDirectory' });
    if (file.copyError) throw new PickError(t('Não foi possível ler o arquivo escolhido.'));
    if (file.size && file.size > MAX_PICK_BYTES) throw new PickError(t('O áudio passa de 64 MB.'));
    return {
      uri: file.fileCopyUri ?? file.uri,
      name: file.name ?? `audio-${Date.now()}`,
      mimeType: file.type ?? 'audio/mpeg',
      size: file.size ?? undefined,
    };
  } catch (e) {
    if (DocumentPicker.isCancel(e)) return null;
    if (e instanceof PickError) throw e;
    throw new PickError(t('Não foi possível abrir os arquivos do celular.'));
  }
}

/** A câmera existe nesta plataforma (na web de testes, não). */
export const canUseCamera = true;
