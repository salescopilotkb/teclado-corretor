/**
 * MediaPicker — versão WEB (site de testes): o seletor de arquivos do navegador.
 * Mesma API do MediaPicker.ts. A "câmera" usa o atributo capture, que no
 * celular abre a câmera e no computador cai no seletor de arquivos.
 */
import type { LocalMedia } from '../services/mediaUpload';
import { MAX_PICK_BYTES } from '../files/limits';
import { t } from '../i18n';

export type MediaKind = 'image' | 'video';

export class PickError extends Error {}

function chooseFile(accept: string, capture?: string): Promise<LocalMedia | null> {
  return new Promise((resolve, reject) => {
    const doc = (globalThis as { document?: any }).document;
    if (!doc) {
      resolve(null);
      return;
    }
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', capture);
    input.style.display = 'none';
    // Fechou o seletor sem escolher (Chrome, Firefox e Safari atuais avisam com "cancel")
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > MAX_PICK_BYTES) {
        reject(new PickError(t('O arquivo passa de 64 MB.')));
        return;
      }
      resolve({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, file });
    };
    doc.body.appendChild(input);
    input.click();
  });
}

export const pickFromGallery = (kind: MediaKind) => chooseFile(kind === 'image' ? 'image/*' : 'video/*');
export const captureWithCamera = (kind: MediaKind) => chooseFile(kind === 'image' ? 'image/*' : 'video/*', 'environment');
export const pickAudioFile = () => chooseFile('audio/*');
export const pickPhotoOrVideo = () => chooseFile('image/*,video/*');

/** No navegador do computador não há câmera de verdade para esse fluxo. */
export const canUseCamera = false;
