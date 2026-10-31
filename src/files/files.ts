/**
 * Regras da seção Arquivos usadas pelo app e pelo teclado: pastas com
 * subpastas (qualquer nível) e fotos/vídeos dentro delas.
 */
import { t, tSell } from '../i18n';
import type { LocalMedia, UploadedMedia } from '../services/mediaUpload';
import { formatDuration } from '../services/mediaUpload';
import type { FileFolder, FilesData, SavedFile, SavedFileType } from '../types';

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

/** Ordem escolhida pela pessoa primeiro; o que nunca foi reordenado vem depois, na ordem padrão. */
const byPosition = (a: { position?: number }, b: { position?: number }) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);

/** Pastas dentro de `parentId` (null = raiz): na ordem escolhida, depois em ordem alfabética. */
export function subfolders(data: FilesData, parentId: string | null): FileFolder[] {
  return data.folders.filter(f => (f.parentId ?? null) === parentId).sort((a, b) => byPosition(a, b) || byName(a, b));
}

/** Arquivos dentro da pasta (null = soltos na raiz): na ordem escolhida, depois os mais novos primeiro. */
export function filesIn(data: FilesData, folderId: string | null): SavedFile[] {
  return data.files
    .filter(f => (f.folderId ?? null) === folderId)
    .sort((a, b) => byPosition(a, b) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Aparece no teclado? (sem valor = sim) */
export const showsInKeyboard = (item: { inKeyboard?: boolean }) => item.inKeyboard !== false;

/**
 * O Locker como o teclado mostra: só o que está marcado para o teclado. Uma pasta
 * fora do teclado leva junto as subpastas e os arquivos de dentro.
 */
export function keyboardView(data: FilesData): FilesData {
  const hidden = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of data.folders) {
      if (hidden.has(f.id)) continue;
      if (!showsInKeyboard(f) || (f.parentId && hidden.has(f.parentId))) {
        hidden.add(f.id);
        grew = true;
      }
    }
  }
  return {
    folders: data.folders.filter(f => !hidden.has(f.id)),
    files: data.files.filter(f => showsInKeyboard(f) && !(f.folderId && hidden.has(f.folderId))),
  };
}

/**
 * Nova ordem de um nível (as pastas ou os arquivos de uma pasta): devolve só os
 * itens cuja posição mudou, para gravar. Começa em 1: no banco, 0 é "nunca reordenado".
 */
export function withPositions<T extends { id: string; position?: number }>(ordered: T[]): T[] {
  return ordered
    .map((item, i) => ({ item, position: i + 1 }))
    .filter(({ item, position }) => item.position !== position)
    .map(({ item, position }) => ({ ...item, position }));
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

/** Nome de cada tipo (também o rótulo do link que vai para a conversa). */
export const FILE_TYPE_LABEL: Record<SavedFileType, string> = {
  image: 'Foto',
  video: 'Vídeo',
  audio: 'Áudio',
  pdf: 'PDF',
  document: 'Documento',
  other: 'Arquivo',
};

const DOC_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|odp|txt|csv|rtf|pages|numbers|key)$/i;

/** Tipo do arquivo pelo tipo do conteúdo (mime), pelo que a nuvem diz (kind) e pelo nome. */
export function savedFileType(kind?: string, mime?: string, name?: string): SavedFileType {
  const m = mime ?? '';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || /\.pdf$/i.test(name ?? '')) return 'pdf';
  if (m.startsWith('text/') || /document|sheet|presentation|msword/.test(m) || DOC_EXT.test(name ?? '')) return 'document';
  if (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'pdf' || kind === 'document') return kind;
  return m ? 'other' : 'image';
}

/** Nome do arquivo sem a extensão e sem o "IMG_2024..." técnico, quando der. */
function titleFromName(name: string, type: SavedFile['type']): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (!base || /^(img|vid|pxl|dsc|photo|video|foto)[-_ ]?\d/i.test(base) || /^\d+[-_]\d+$/.test(base)) {
    return t(FILE_TYPE_LABEL[type]);
  }
  return base;
}

/** Arquivo novo a partir do que foi enviado para a nuvem. */
export function savedFileFrom(media: LocalMedia, uploaded: UploadedMedia, folderId: string | null): SavedFile {
  const type = savedFileType(undefined, media.mimeType, media.name);
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
 * Nova versão do mesmo arquivo: troca o conteúdo e mantém o id, o nome, a pasta, o
 * link permanente (/f/...) e o lugar no teclado.
 */
export function replacedFile(file: SavedFile, media: LocalMedia, uploaded: UploadedMedia): SavedFile {
  const mime = uploaded.mime ?? media.mimeType;
  return {
    ...file,
    type: savedFileType(undefined, mime, media.name),
    url: uploaded.url,
    storagePath: uploaded.storagePath,
    urlExpiresAt: uploaded.expiresAt,
    mime,
    size: uploaded.size ?? media.size,
    duration: formatDuration(media.durationMs) || undefined,
  };
}

/**
 * Texto que vai para a conversa quando o app não recebe o arquivo. Usa o link
 * permanente do Locker (abre sem login); o link do R2 venceria em 7 dias.
 */
export function fileLink(file: SavedFile): string {
  const url = file.shareToken ? `${LOCKER_WEB_URL}/f/${file.shareToken}` : file.url;
  return `[${tSell(FILE_TYPE_LABEL[file.type] ?? 'Arquivo')}] ${file.title}: ${url}`;
}

/** Endereço do Locker web (links públicos de arquivos e pastas). */
export const LOCKER_WEB_URL = 'https://locker.keyconapp.com';
