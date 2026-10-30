/**
 * Locker: os arquivos da seção Arquivos na nuvem, sincronizados entre o app, o
 * teclado e o Locker web (locker.keyconapp.com).
 *
 *  - Os ARQUIVOS vão para o Cloudflare R2 (Edge Function "locker"): o app pede um
 *    link temporário, envia direto para o R2 e guarda "r2:<caminho>". Para enviar
 *    ao cliente, o teclado usa um link de download que vale 7 dias e é renovado
 *    antes de vencer.
 *  - A ORGANIZAÇÃO (pastas, nomes, o que vai para o teclado) fica nas tabelas
 *    locker_folders e locker_files do Supabase (supabase/locker.sql).
 *  - App e teclado continuam lendo a cópia local (Repo.getFiles): funciona sem
 *    internet e o teclado abre na hora. Cada mudança local entra numa fila e sobe
 *    quando der; as mudanças feitas em outro lugar chegam pelo tempo real.
 *
 * Enquanto o Locker não está instalado (sem as tabelas ou sem as chaves do R2),
 * tudo funciona como antes: só no aparelho e no bucket "media" do Supabase. O que
 * for feito nesse tempo fica na fila e sobe quando o Locker for instalado.
 *
 * Sem migração dos dados antigos: na fase de testes, o Locker começa do zero em
 * cada aparelho (resetOnce).
 */
import { Linking } from 'react-native';
import { DEMO_MODE } from '../config/demo';
import { t } from '../i18n';
import { supabase } from '../services/supabase';
import { MAX_UPLOAD_BYTES, UploadError, uploadMedia } from '../services/mediaUpload';
import type { LocalMedia, UploadedMedia } from '../services/mediaUpload';
import { Repo, storage } from '../storage/storage';
import type { FileFolder, FilesData, SavedFile } from '../types';
import { LOCKER_WEB_URL } from './files';

const FUNCTION = 'locker';
const PENDING_KEY = 'locker.pending';
/** Limpeza única da versão do Locker: apaga do aparelho os arquivos de teste de antes. */
const RESET_KEY = 'locker.reset.v1';
/** Renova o link de download quando falta menos que isto para vencer. */
const RENEW_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;
const R2_PREFIX = 'r2:';

// ── Chamadas à Edge Function ───────────────────────────────────────────────

type LockerReply<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Chama a função "locker" e devolve o erro já lido (sem lançar). */
async function callLocker<T>(body: Record<string, unknown>): Promise<LockerReply<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(FUNCTION, { body });
    if (!error) return { ok: true, data: data as T };
    const context = (error as { context?: Response }).context;
    const status = context?.status ?? 0;
    let code = '';
    try {
      code = String((await context?.json())?.error ?? '');
    } catch {
      // sem corpo JSON (função não publicada, sem internet)
    }
    return { ok: false, status, error: code || error.message || 'failed' };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'failed' };
  }
}

/** O R2 ainda não está ligado (sem as chaves) ou a função não foi publicada: usa o jeito antigo. */
const r2Unavailable = (r: { ok: false; status: number; error: string }) =>
  r.error === 'r2_not_configured' || r.status === 404 || r.status === 503;

// ── Envio de arquivo ───────────────────────────────────────────────────────

/** O arquivo do aparelho como Blob (no navegador ele já vem pronto). */
async function blobOf(media: LocalMedia): Promise<Blob> {
  if (media.file) return media.file;
  const res = await fetch(media.uri);
  return res.blob();
}

/**
 * Envia o arquivo para o Locker (Cloudflare R2). Sem o R2 configurado, envia
 * para o bucket "media" do Supabase, como antes. `onProgress` vai de 0 a 1.
 */
export async function uploadToLocker(media: LocalMedia, onProgress?: (fraction: number) => void): Promise<UploadedMedia> {
  if (DEMO_MODE) return uploadMedia(media, onProgress);
  if (media.size && media.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(t('O arquivo passa de 50 MB. Escolha um menor ou mande o link.'));
  }
  const blob = await blobOf(media);
  const size = media.size || blob.size;
  const mime = media.mimeType || blob.type || 'application/octet-stream';

  const reply = await callLocker<{ key: string; uploadUrl: string }>({ action: 'upload', name: media.name, mime, size });
  if (!reply.ok) {
    if (r2Unavailable(reply)) return uploadMedia(media, onProgress);
    if (reply.error === 'quota_exceeded') {
      throw new UploadError(t('Seu Locker está cheio. Libere espaço ou mude de plano para enviar mais arquivos.'));
    }
    if (reply.error === 'file_too_large') throw new UploadError(t('O arquivo passa do limite de 50 MB.'));
    if (reply.status === 401) throw new UploadError(t('Sessão expirada. Entre na conta de novo para enviar arquivos.'));
    throw new UploadError(t('Sem conexão com a internet. Verifique e tente de novo.'));
  }

  // Direto para o R2 (o link assinado vale 15 minutos)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', reply.data.uploadUrl);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new UploadError(t('Não foi possível enviar o arquivo (erro {status}).', { status: xhr.status })));
      }
    };
    xhr.onerror = () => reject(new UploadError(t('Sem conexão com a internet. Verifique e tente de novo.')));
    xhr.ontimeout = () => reject(new UploadError(t('O envio demorou demais. Tente de novo com uma conexão melhor.')));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(blob);
  });

  const key = reply.data.key;
  const urls = await signKeys([key]);
  return {
    url: urls[key]?.url ?? '',
    storagePath: R2_PREFIX + key,
    expiresAt: urls[key]?.expiresAt,
    mime,
    size,
  };
}

/** Links de download (7 dias) dos arquivos no R2. Falhou: devolve vazio. */
async function signKeys(keys: string[]): Promise<Record<string, { url: string; expiresAt: number }>> {
  if (!keys.length) return {};
  const out: Record<string, { url: string; expiresAt: number }> = {};
  for (let i = 0; i < keys.length; i += 100) {
    const reply = await callLocker<{ urls: Record<string, string>; expiresIn: number }>({ action: 'sign', keys: keys.slice(i, i + 100) });
    if (!reply.ok) break;
    const expiresAt = Date.now() + reply.data.expiresIn * 1000;
    for (const [key, url] of Object.entries(reply.data.urls)) out[key] = { url, expiresAt };
  }
  return out;
}

export const isLockerPath = (storagePath: string | undefined) => !!storagePath?.startsWith(R2_PREFIX);

// ── Linhas das tabelas ↔ dados do app ─────────────────────────────────────

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  position?: number;
  in_keyboard?: boolean;
  created_at: string;
  visibility?: FileFolder['visibility'];
  share_token?: string;
}

interface FileRow {
  id: string;
  folder_id: string | null;
  name: string;
  kind: string;
  mime: string;
  size_bytes: number;
  storage: 'r2' | 'supabase' | 'link';
  object_key: string;
  url: string;
  duration: string | null;
  position?: number;
  in_keyboard?: boolean;
  created_at: string;
  share_token?: string;
}

/**
 * O código do link (share_token) nasce na nuvem e nunca é enviado daqui: numa
 * pasta ou arquivo novo vale o padrão do banco; numa alteração, o que já existe.
 * A visibilidade só vai quando a pessoa escolheu (sem valor = privada).
 */
const folderRow = (f: FileFolder): FolderRow => ({
  id: f.id,
  parent_id: f.parentId ?? null,
  name: f.name,
  created_at: f.createdAt,
  ...(f.visibility ? { visibility: f.visibility } : {}),
});

function fileRow(f: SavedFile): FileRow {
  const path = f.storagePath ?? '';
  const storage: FileRow['storage'] = path.startsWith(R2_PREFIX) ? 'r2' : path ? 'supabase' : 'link';
  return {
    id: f.id,
    folder_id: f.folderId ?? null,
    name: f.title,
    kind: f.type,
    mime: f.mime ?? '',
    size_bytes: f.size ?? 0,
    storage,
    object_key: storage === 'r2' ? path.slice(R2_PREFIX.length) : path,
    // No R2 o link é temporário: não vai para a tabela
    url: storage === 'r2' ? '' : f.url,
    duration: f.duration ?? null,
    created_at: f.createdAt,
  };
}

const folderFrom = (r: FolderRow): FileFolder => ({
  id: r.id,
  name: r.name,
  parentId: r.parent_id ?? null,
  createdAt: r.created_at,
  visibility: r.visibility ?? 'private',
  shareToken: r.share_token || undefined,
});

function fileFrom(r: FileRow, local: SavedFile | undefined): SavedFile {
  const storagePath = r.storage === 'r2' ? R2_PREFIX + r.object_key : r.storage === 'supabase' ? r.object_key : undefined;
  // R2: aproveita o link que o aparelho já tem (a renovação vem depois)
  const keepLink = r.storage === 'r2' && local?.storagePath === storagePath;
  return {
    id: r.id,
    folderId: r.folder_id ?? null,
    type: r.kind === 'video' ? 'video' : 'image',
    title: r.name,
    url: r.storage === 'r2' ? (keepLink ? local!.url : '') : r.url,
    urlExpiresAt: keepLink ? local!.urlExpiresAt : undefined,
    storagePath,
    duration: r.duration ?? undefined,
    createdAt: r.created_at,
    mime: r.mime || undefined,
    size: Number(r.size_bytes) || undefined,
    shareToken: r.share_token || undefined,
  };
}

// ── Fila de mudanças locais ────────────────────────────────────────────────

type Op =
  | { kind: 'folder'; id: string; row: FolderRow }
  | { kind: 'file'; id: string; row: FileRow }
  | { kind: 'deleteFolder'; id: string }
  | { kind: 'deleteFile'; id: string };

function readPending(): Op[] {
  try {
    const list = JSON.parse(storage.getString(PENDING_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const writePending = (ops: Op[]) => storage.set(PENDING_KEY, JSON.stringify(ops));

/** Entra na fila (a mudança mais nova do mesmo item substitui a anterior) e sobe logo. */
function enqueue(op: Op) {
  if (DEMO_MODE) return;
  const same = (o: Op) => o.id === op.id && (o.kind === 'folder' || o.kind === 'deleteFolder') === (op.kind === 'folder' || op.kind === 'deleteFolder');
  writePending([...readPending().filter(o => !same(o)), op]);
  scheduleFlush();
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {});
  }, 300);
}

/** As tabelas do Locker ainda não existem (supabase/locker.sql não foi rodado). */
const missingTable = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? '');

let installed: boolean | null = null;
let flushing: Promise<boolean> | null = null;

/** Sobe a fila na ordem. true = a fila esvaziou. */
function flush(): Promise<boolean> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<boolean> {
  if (DEMO_MODE || installed === false) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  let ops = readPending();
  while (ops.length) {
    const op = ops[0];
    const result =
      op.kind === 'folder'
        ? await supabase.from('locker_folders').upsert(op.row)
        : op.kind === 'file'
          ? await supabase.from('locker_files').upsert(op.row)
          : op.kind === 'deleteFolder'
            ? await supabase.from('locker_folders').delete().eq('id', op.id)
            : await supabase.from('locker_files').delete().eq('id', op.id);
    if (result.error) {
      if (missingTable(result.error)) installed = false;
      return false; // sem internet ou Locker não instalado: tenta de novo depois
    }
    // Tira da fila o que subiu (outra mudança pode ter entrado enquanto isso)
    ops = readPending().filter(o => o !== op && !(o.kind === op.kind && o.id === op.id && JSON.stringify(o) === JSON.stringify(op)));
    writePending(ops);
  }
  return true;
}

// ── O que o app e o teclado chamam no lugar do Repo ────────────────────────

export function lockerSaveFolder(folder: FileFolder) {
  Repo.saveFileFolder(folder);
  enqueue({ kind: 'folder', id: folder.id, row: folderRow(folder) });
}

export function lockerSaveFile(file: SavedFile) {
  Repo.saveFile(file);
  enqueue({ kind: 'file', id: file.id, row: fileRow(file) });
}

/** Exclui a pasta com as subpastas e os arquivos (na nuvem, a exclusão leva tudo junto). */
export function lockerDeleteFolder(folderId: string): SavedFile[] {
  const removed = Repo.deleteFileFolder(folderId);
  enqueue({ kind: 'deleteFolder', id: folderId });
  return removed;
}

export function lockerDeleteFile(id: string) {
  Repo.deleteFile(id);
  enqueue({ kind: 'deleteFile', id });
}

// ── Sincronização ──────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
/** Os arquivos mudaram por causa da nuvem (outro aparelho, o Locker web): recarregue a tela. */
export function onLockerChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let pulling: Promise<void> | null = null;

/** Traz da nuvem e atualiza a cópia local (e renova os links do R2). */
export function pullLocker(): Promise<void> {
  if (!pulling) {
    pulling = doPull().finally(() => {
      pulling = null;
    });
  }
  return pulling;
}

async function doPull(): Promise<void> {
  if (DEMO_MODE) return;
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return;

  // O que mudou aqui sobe antes: a nuvem não pode desfazer uma mudança que ainda não chegou
  if (readPending().length && !(await flush())) return;

  const [folders, files] = await Promise.all([
    supabase.from('locker_folders').select('id, parent_id, name, position, in_keyboard, created_at, visibility, share_token').is('trashed_at', null),
    supabase.from('locker_files').select('id, folder_id, name, kind, mime, size_bytes, storage, object_key, url, duration, position, in_keyboard, created_at, share_token').is('trashed_at', null),
  ]);
  const error = folders.error ?? files.error;
  if (error) {
    if (missingTable(error)) installed = false;
    return;
  }
  installed = true;
  const local = Repo.getFiles();

  const byId = new Map(local.files.map(f => [f.id, f]));
  const next: FilesData = {
    folders: (folders.data as FolderRow[]).map(folderFrom),
    files: (files.data as FileRow[]).map(r => fileFrom(r, byId.get(r.id))),
  };

  // Links do R2 que faltam ou vencem logo
  const stale = next.files.filter(f => isLockerPath(f.storagePath) && (!f.url || (f.urlExpiresAt ?? 0) - Date.now() < RENEW_BEFORE_MS));
  if (stale.length) {
    const urls = await signKeys(stale.map(f => f.storagePath!.slice(R2_PREFIX.length)));
    for (const f of stale) {
      const signed = urls[f.storagePath!.slice(R2_PREFIX.length)];
      if (signed) {
        f.url = signed.url;
        f.urlExpiresAt = signed.expiresAt;
      }
    }
  }

  if (JSON.stringify(next) !== JSON.stringify(local)) {
    Repo.setFiles(next);
    listeners.forEach(cb => cb());
  }
}

/**
 * Uma vez por aparelho, na primeira abertura desta versão: o Locker começa do zero
 * (os arquivos de antes eram de teste). Depois disso, o que vale é a nuvem.
 */
function resetOnce() {
  if (storage.getBoolean(RESET_KEY)) return;
  Repo.setFiles({ folders: [], files: [] });
  storage.delete(PENDING_KEY);
  storage.set(RESET_KEY, true);
  listeners.forEach(cb => cb());
}

let users = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Liga a sincronização (app logado, teclado aberto). Pode ser chamada por mais de
 * uma tela: só desliga quando a última sair.
 */
export function startLockerSync(): () => void {
  if (DEMO_MODE) return () => {};
  resetOnce();
  users++;
  pullLocker().catch(() => {});
  if (users === 1) {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId || channel || users === 0) return;
      const later = () => {
        if (pullTimer) clearTimeout(pullTimer);
        pullTimer = setTimeout(() => pullLocker().catch(() => {}), 400);
      };
      channel = supabase
        .channel(`locker-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locker_folders', filter: `user_id=eq.${userId}` }, later)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locker_files', filter: `user_id=eq.${userId}` }, later)
        .subscribe();
    });
  }
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

export { LOCKER_WEB_URL };

/**
 * Abre o Locker web no navegador já logado: o servidor (Edge Function
 * "locker-handoff") gera um link de entrada de uso único para a conta. Sem a
 * função publicada ou sem internet, abre a página de login do Locker.
 */
export async function openLockerWeb(path = '/'): Promise<void> {
  let target = `${LOCKER_WEB_URL}${path}`;
  if (!DEMO_MODE) {
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string }>('locker-handoff', { body: { path } });
      if (!error && data?.url) target = data.url;
    } catch {
      // abre sem a entrada automática
    }
  }
  await Linking.openURL(target);
}

/**
 * Link público do arquivo: abre sem login, para sempre (até o arquivo ir para a
 * lixeira). null = o arquivo ainda não chegou à nuvem (sem o código do link).
 */
export function lockerFileLink(file: SavedFile): string | null {
  return file.shareToken ? `${LOCKER_WEB_URL}/f/${file.shareToken}` : null;
}

/** Link da pasta: só abre se ela estiver como "só com o link" ou "pública". */
export function lockerFolderLink(folder: FileFolder): string | null {
  return folder.shareToken ? `${LOCKER_WEB_URL}/d/${folder.shareToken}` : null;
}

/** Quem pode ver a pasta pelo Locker (vai para a nuvem como qualquer mudança). */
export function setFolderVisibility(folder: FileFolder, visibility: NonNullable<FileFolder['visibility']>) {
  lockerSaveFolder({ ...folder, visibility });
}

/** Espaço usado e limite do plano (null = Locker ainda não instalado). */
export async function lockerUsage(): Promise<{ used: number; limit: number; plan: string } | null> {
  const reply = await callLocker<{ used: number; limit: number; plan: string }>({ action: 'usage' });
  return reply.ok ? reply.data : null;
}
