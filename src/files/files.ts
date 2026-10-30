/**
 * Regras da seção Arquivos usadas pelo app e pelo teclado: pastas com
 * subpastas (qualquer nível) e fotos/vídeos dentro delas.
 */
import { t, tSell } from '../i18n';
import type { LocalMedia, UploadedMedia } from '../services/mediaUpload';
import { formatDuration } from '../services/mediaUpload';
import type { FileFolder, FilesData, SavedFile } from '../types';

/** Nome da seção (marca do KEYCON): o mesmo em português, inglês e espanhol, sem tradução. */
export const LOCKER_NAME = 'Locker';

export function newFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Também é a chave da pasta na nuvem (Locker): não pode repetir entre aparelhos. */
export function newFileFolderId(): string {
  return `ffolder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Pastas dentro de `parentId` (null = raiz), em ordem alfabética. */
export function subfolders(data: FilesData, parentId: string | null): FileFolder[] {
  return data.folders.filter(f => (f.parentId ?? null) === parentId).sort(byName);
}

/** Arquivos dentro da pasta (null = soltos na raiz), os mais novos primeiro. */
export function filesIn(data: FilesData, folderId: string | null): SavedFile[] {
  return data.files
    .filter(f => (f.folderId ?? null) === folderId)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Caminho da raiz até a pasta (para o "Arquivos › Clientes › Fotos"). */
export function folderPath(data: FilesData, folderId: string | null): FileFolder[] {
  const path: FileFolder[] = [];
  const seen = new Set<string>();
  let id = folderId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = data.folders.find(f => f.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

/** "Locker › Clientes › Fotos" (ou só "Locker" na raiz). */
export function folderPathLabel(data: FilesData, folderId: string | null): string {
  return [LOCKER_NAME, ...folderPath(data, folderId).map(f => f.name)].join(' › ');
}

/** A pasta e todas as subpastas dela (para não mover uma pasta para dentro dela mesma). */
export function descendantIds(data: FilesData, folderId: string): Set<string> {
  const out = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of data.folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

/** "2 pastas · 5 arquivos" (o que está direto dentro da pasta). */
export function folderSummary(data: FilesData, folderId: string): string {
  const folders = subfolders(data, folderId).length;
  const files = filesIn(data, folderId).length;
  const parts: string[] = [];
  if (folders) parts.push(folders === 1 ? t('1 pasta') : t('{n} pastas', { n: folders }));
  parts.push(files === 1 ? t('1 arquivo') : t('{n} arquivos', { n: files }));
  return parts.join(' · ');
}

/** Todas as pastas com o caminho completo, para a lista "Mover para". */
export function moveTargets(data: FilesData, exclude?: Set<string>): Array<{ id: string | null; label: string }> {
  const out: Array<{ id: string | null; label: string }> = [{ id: null, label: t('Arquivos (início)') }];
  const walk = (parentId: string | null, prefix: string) => {
    for (const f of subfolders(data, parentId)) {
      if (exclude?.has(f.id)) continue;
      const label = prefix ? `${prefix} › ${f.name}` : f.name;
      out.push({ id: f.id, label });
      walk(f.id, label);
    }
  };
  walk(null, '');
  return out;
}

/** Nome do arquivo sem a extensão e sem o "IMG_2024..." técnico, quando der. */
function titleFromName(name: string, type: SavedFile['type']): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (!base || /^(img|vid|pxl|dsc|photo|video|foto)[-_ ]?\d/i.test(base) || /^\d+[-_]\d+$/.test(base)) {
    return type === 'image' ? t('Foto') : t('Vídeo');
  }
  return base;
}

/** Arquivo novo a partir do que foi enviado para a nuvem. */
export function savedFileFrom(media: LocalMedia, uploaded: UploadedMedia, folderId: string | null): SavedFile {
  const type: SavedFile['type'] = media.mimeType.startsWith('video/') ? 'video' : 'image';
  return {
    id: newFileId(),
    folderId,
    type,
    title: titleFromName(media.name, type),
    url: uploaded.url,
    storagePath: uploaded.storagePath,
    duration: formatDuration(media.durationMs) || undefined,
    createdAt: new Date().toISOString(),
    mime: uploaded.mime ?? media.mimeType,
    size: uploaded.size ?? media.size,
    urlExpiresAt: uploaded.expiresAt,
  };
}

/**
 * Texto que vai para a conversa quando o app não recebe o arquivo. Usa o link
 * permanente do Locker (abre sem login); o link do R2 venceria em 7 dias.
 */
export function fileLink(file: SavedFile): string {
  const url = file.shareToken ? `${LOCKER_WEB_URL}/f/${file.shareToken}` : file.url;
  return `[${tSell(file.type === 'image' ? 'Foto' : 'Vídeo')}] ${file.title}: ${url}`;
}

/** Endereço do Locker web (links públicos de arquivos e pastas). */
export const LOCKER_WEB_URL = 'https://locker.keyconapp.com';
