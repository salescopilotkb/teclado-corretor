/**
 * Envio de arquivos e de pastas inteiras para o Locker (botão Novo ou arrastando
 * para a página). Pastas: recria a mesma árvore no Locker antes de mandar os
 * arquivos. Os envios andam três de cada vez e aparecem no painel do canto.
 *
 * Caminho de cada arquivo (o mesmo do app, src/files/locker.ts):
 *   1. confere o limite do tipo (foto 16 MB, vídeo 64 MB, outros 10 MB);
 *   2. a função "locker" confere o espaço do plano e devolve um link de envio do R2;
 *   3. o navegador manda o arquivo direto para o R2 (com o progresso);
 *   4. grava a linha em locker_files (o app e o teclado recebem em tempo real).
 * Sem o R2 ligado ainda, vai para o bucket "media" do Supabase, como o app faz.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config/supabase';
import { lockerSizeError } from '../../src/files/limits';
import { t } from '../../src/i18n';
import { callLocker, fileType, supabase } from './data';
import type { LockerFile } from './data';

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'error' | 'canceled';

export type UploadJob = {
  id: string;
  name: string;
  size: number;
  mime: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  /** Caiu a internet: envia sozinho quando a conexão voltar. */
  retry?: boolean;
};

/** Um arquivo escolhido ou solto, com as pastas em que ele estava ("Fotos/Verão"). */
export type PickedFile = { file: File; dirs: string[] };

// -----------------------------------------------------------------------------
// Estado do painel de envios (quem desenha assina com subscribeUploads)
// -----------------------------------------------------------------------------
let jobs: UploadJob[] = [];
const listeners = new Set<(jobs: UploadJob[]) => void>();
const aborts = new Map<string, () => void>();
const queue: Array<() => Promise<void>> = [];
let running = 0;
const PARALLEL = 3;

export function subscribeUploads(cb: (jobs: UploadJob[]) => void): () => void {
  listeners.add(cb);
  cb(jobs);
  return () => listeners.delete(cb);
}

function update(id: string, patch: Partial<UploadJob>) {
  jobs = jobs.map(j => (j.id === id ? { ...j, ...patch } : j));
  listeners.forEach(cb => cb(jobs));
}

function add(job: UploadJob) {
  jobs = [...jobs, job];
  listeners.forEach(cb => cb(jobs));
}

/** Limpa o painel (só o que já terminou; o que está indo continua). */
export function clearFinishedUploads() {
  jobs = jobs.filter(j => j.status === 'waiting' || j.status === 'uploading');
  listeners.forEach(cb => cb(jobs));
}

export function cancelUpload(id: string) {
  aborts.get(id)?.();
  retries.delete(id);
  const job = jobs.find(j => j.id === id);
  if (job && (job.status === 'waiting' || job.status === 'uploading')) update(id, { status: 'canceled' });
}

export function cancelAllUploads() {
  jobs.filter(j => j.status === 'waiting' || j.status === 'uploading').forEach(j => cancelUpload(j.id));
}

function pump() {
  while (running < PARALLEL && queue.length) {
    const task = queue.shift()!;
    running++;
    task().finally(() => {
      running--;
      pump();
    });
  }
}

// -----------------------------------------------------------------------------
// Ler o que foi escolhido ou solto
// -----------------------------------------------------------------------------
/** Arquivos do sistema que não interessam a ninguém. */
const JUNK = /^(\.ds_store|thumbs\.db|desktop\.ini|\._.*)$/i;

/** Do campo de arquivos (também o de pasta: webkitRelativePath = "Pasta/Sub/foto.jpg"). */
export function pickedFromInput(list: FileList | null): PickedFile[] {
  return Array.from(list ?? [])
    .filter(f => !JUNK.test(f.name))
    .map(file => {
      const parts = (file.webkitRelativePath || '').split('/').filter(Boolean);
      return { file, dirs: parts.slice(0, -1) };
    });
}

type Entry = FileSystemEntry;

/** Do que foi solto na página, abrindo as pastas (e as pastas dentro delas). */
export async function pickedFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(dt.items ?? [])
    .filter(i => i.kind === 'file')
    .map(i => i.webkitGetAsEntry?.())
    .filter((e): e is Entry => !!e);
  // Navegador sem o leitor de pastas: só os arquivos soltos
  if (!entries.length) return pickedFromInput(dt.files);
  const out: PickedFile[] = [];
  const walk = async (entry: Entry, dirs: string[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File | null>(resolve => (entry as FileSystemFileEntry).file(resolve, () => resolve(null)));
      if (file && !JUNK.test(file.name)) out.push({ file, dirs });
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries devolve aos poucos: lê até vir vazio
    for (;;) {
      const batch = await new Promise<Entry[]>(resolve => reader.readEntries(resolve, () => resolve([])));
      if (!batch.length) break;
      for (const child of batch) await walk(child, [...dirs, entry.name]);
    }
  };
  for (const entry of entries) await walk(entry, []);
  return out;
}

// -----------------------------------------------------------------------------
// Enviar
// -----------------------------------------------------------------------------
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

const rand = () => Math.random().toString(36).slice(2, 6);
const newFolderId = () => `ffolder-${Date.now()}-${rand()}`;
const newFileId = () => `file-${Date.now()}-${rand()}`;

/** Erro com a mensagem pronta para mostrar no painel. */
class UploadFail extends Error {}
/** Sem conexão: tenta de novo quando a internet voltar. */
class Offline extends UploadFail {}
class Canceled extends Error {}

/** O R2 ainda não foi ligado (sem as chaves ou a função não publicada): usa o bucket "media". */
let r2Off = false;

/** Manda o corpo com XHR (o fetch não dá o progresso do envio). */
function send(
  jobId: string,
  method: 'PUT' | 'POST',
  url: string,
  headers: Record<string, string>,
  body: Blob | FormData,
  onError: (status: number, text: string) => string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && e.total > 0) update(jobId, { progress: Math.min(0.99, e.loaded / e.total) });
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadFail(onError(xhr.status, xhr.responseText))));
    xhr.onerror = () => reject(new Offline(t('Sem conexão com a internet. Verifique e tente de novo.')));
    xhr.ontimeout = () => reject(new UploadFail(t('O envio demorou demais. Tente de novo com uma conexão melhor.')));
    xhr.onabort = () => reject(new Canceled());
    xhr.timeout = 10 * 60 * 1000;
    aborts.set(jobId, () => xhr.abort());
    xhr.send(body);
  });
}

type Stored = { storage: 'r2' | 'supabase'; key: string; url: string };

async function toR2(jobId: string, file: File, mime: string): Promise<Stored | null> {
  const reply = await callLocker({ action: 'upload', name: file.name, mime, size: file.size });
  if (!reply.ok) {
    if (reply.error === 'r2_not_configured' || reply.status === 404 || reply.status === 503) {
      r2Off = true;
      return null;
    }
    if (reply.error === 'quota_exceeded') throw new UploadFail(t('Seu Locker está cheio. Libere espaço ou mude de plano para enviar mais arquivos.'));
    if (reply.error === 'file_too_large') throw new UploadFail(lockerSizeError(mime, file.size) ?? t('O arquivo é grande demais para o Locker.'));
    if (reply.status === 401) throw new UploadFail(t('Sessão expirada. Entre na conta de novo para enviar arquivos.'));
    throw new Offline(t('Sem conexão com a internet. Verifique e tente de novo.'));
  }
  const { key, uploadUrl } = reply.data as { key: string; uploadUrl: string };
  await send(jobId, 'PUT', uploadUrl, { 'Content-Type': mime }, file, status => t('Não foi possível enviar o arquivo (erro {status}).', { status }));
  const signed = await callLocker({ action: 'sign', keys: [key] });
  return { storage: 'r2', key, url: signed.ok ? signed.data?.urls?.[key] ?? '' : '' };
}

async function toBucket(jobId: string, file: File, userId: string, token: string): Promise<Stored> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const key = `${userId}/${Date.now()}-${rand()}${rand()}.${ext}`;
  const form = new FormData();
  form.append('file', file, file.name);
  await send(
    jobId,
    'POST',
    `${SUPABASE_URL}/storage/v1/object/media/${key}`,
    { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'x-upsert': 'false' },
    form,
    (status, text) =>
      status === 413 || /payload too large|exceeded the maximum/i.test(text)
        ? t('O arquivo passa do limite de 50 MB.')
        : status === 401 || status === 403
          ? t('Sem permissão para enviar. Entre na conta de novo.')
          : t('Não foi possível enviar o arquivo (erro {status}).', { status }),
  );
  return { storage: 'supabase', key, url: `${SUPABASE_URL}/storage/v1/object/public/media/${key}` };
}

/**
 * Cria as pastas que vieram junto (a mesma árvore, dentro da pasta de destino)
 * e devolve onde cada arquivo vai. Pastas com o mesmo nome viram pastas novas,
 * como no Drive.
 */
async function createTree(picked: PickedFile[], target: string | null): Promise<Map<string, string | null>> {
  const ids = new Map<string, string | null>([['', target]]);
  const paths = new Set<string>();
  picked.forEach(p => p.dirs.forEach((_, i) => paths.add(p.dirs.slice(0, i + 1).join('/'))));
  const ordered = [...paths].sort((a, b) => a.split('/').length - b.split('/').length);
  for (const path of ordered) {
    const parts = path.split('/');
    const id = newFolderId();
    const parent = ids.get(parts.slice(0, -1).join('/')) ?? target;
    const { error } = await supabase.from('locker_folders').insert({ id, name: parts[parts.length - 1], parent_id: parent });
    if (error) throw new UploadFail(t('Não foi possível criar a pasta "{name}".', { name: parts[parts.length - 1] }));
    ids.set(path, id);
  }
  return ids;
}

/**
 * Põe os arquivos na fila de envio, dentro da pasta `target` (null = Meu Locker).
 * `onSaved` avisa a cada arquivo gravado (a tela recarrega).
 * Devolve uma mensagem se nada pôde começar (ex.: pastas não criadas).
 */
export async function startUploads(picked: PickedFile[], target: string | null, onSaved: () => void): Promise<string | null> {
  if (!picked.length) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return t('Sessão expirada. Entre na conta de novo para enviar arquivos.');

  let folders: Map<string, string | null>;
  try {
    folders = await createTree(picked, target);
    if (folders.size > 1) onSaved();
  } catch (e) {
    return e instanceof Error ? e.message : t('Não foi possível enviar.');
  }

  for (const { file, dirs } of picked) {
    const id = `up-${Date.now()}-${rand()}${rand()}`;
    const mime = mimeOf(file);
    const folderId = folders.get(dirs.join('/')) ?? target;
    const tooBig = lockerSizeError(mime, file.size);
    add({ id, name: file.name, size: file.size, mime, status: tooBig ? 'error' : 'waiting', progress: 0, error: tooBig ?? undefined });
    if (tooBig) continue;

    const task = async () => {
      if (jobs.find(j => j.id === id)?.status === 'canceled') return;
      update(id, { status: 'uploading', retry: false, error: undefined });
      try {
        if (!navigator.onLine) throw new Offline('offline');
        // Sessão de agora (o envio pode ter esperado a internet voltar)
        const token = (await supabase.auth.getSession()).data.session?.access_token ?? session.access_token;
        const stored = (!r2Off && (await toR2(id, file, mime))) || (await toBucket(id, file, session.user.id, token));
        if (jobs.find(j => j.id === id)?.status === 'canceled') return;
        const { error } = await supabase.from('locker_files').insert({
          id: newFileId(),
          folder_id: folderId,
          name: file.name,
          kind: fileType({ mime, kind: '', name: file.name }),
          mime,
          size_bytes: file.size,
          storage: stored.storage,
          object_key: stored.key,
          url: stored.url,
        });
        if (error) throw new UploadFail(t('O arquivo subiu, mas não entrou no Locker. Tente de novo.'));
        update(id, { status: 'done', progress: 1 });
        onSaved();
      } catch (e) {
        taskFailed(id, task, e);
      } finally {
        aborts.delete(id);
      }
    };
    queue.push(task);
  }
  pump();
  return null;
}

/** Envios que pararam porque a internet caiu: voltam para a fila. */
const retries = new Map<string, () => Promise<void>>();

/** Cancelado, sem internet (tenta de novo sozinho) ou erro com a mensagem pronta. */
function taskFailed(id: string, task: () => Promise<void>, e: unknown) {
  if (e instanceof Canceled) update(id, { status: 'canceled' });
  else if (e instanceof Offline) {
    retries.set(id, task);
    update(id, { status: 'error', retry: true, progress: 0, error: t('Sem internet. Envia sozinho quando a conexão voltar.') });
  } else update(id, { status: 'error', error: e instanceof UploadFail ? e.message : t('Não foi possível enviar o arquivo.') });
}

/**
 * "Trocar por nova versão": envia o arquivo novo e troca o conteúdo do mesmo item.
 * Continuam o id, o nome (só a extensão muda, se o tipo mudou), a pasta, o link
 * permanente /f/..., a estrela e o lugar no teclado. A versão antiga é apagada.
 */
export async function replaceUpload(target: LockerFile, file: File, onSaved: () => void): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return t('Sessão expirada. Entre na conta de novo para enviar arquivos.');
  const mime = mimeOf(file);
  const tooBig = lockerSizeError(mime, file.size);
  if (tooBig) return tooBig;

  const id = `up-${Date.now()}-${rand()}${rand()}`;
  add({ id, name: t('Nova versão de {name}', { name: target.name }), size: file.size, mime, status: 'waiting', progress: 0 });
  const task = async () => {
    if (jobs.find(j => j.id === id)?.status === 'canceled') return;
    update(id, { status: 'uploading', retry: false, error: undefined });
    try {
      if (!navigator.onLine) throw new Offline('offline');
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? session.access_token;
      const stored = (!r2Off && (await toR2(id, file, mime))) || (await toBucket(id, file, session.user.id, token));
      if (jobs.find(j => j.id === id)?.status === 'canceled') return;
      // "foto.jpg" trocada por um PNG vira "foto.png"; nome sem extensão fica igual
      const ext = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1];
      const name = ext && /\.[a-z0-9]{1,8}$/i.test(target.name) ? target.name.replace(/\.[a-z0-9]{1,8}$/i, `.${ext.toLowerCase()}`) : target.name;
      const { error } = await supabase
        .from('locker_files')
        .update({
          name,
          kind: fileType({ mime, kind: '', name: file.name }),
          mime,
          size_bytes: file.size,
          storage: stored.storage,
          object_key: stored.key,
          url: stored.url,
        })
        .eq('id', target.id);
      if (error) throw new UploadFail(t('O arquivo subiu, mas a versão nova não entrou no Locker. Tente de novo.'));
      // A versão antiga sai da nuvem (não ocupa mais espaço)
      if (target.object_key && target.object_key !== stored.key) {
        if (target.storage === 'r2') callLocker({ action: 'delete', keys: [target.object_key] });
        else if (target.storage === 'supabase') supabase.storage.from('media').remove([target.object_key]);
      }
      update(id, { status: 'done', progress: 1 });
      onSaved();
    } catch (e) {
      taskFailed(id, task, e);
    } finally {
      aborts.delete(id);
    }
  };
  queue.push(task);
  pump();
  return null;
}

export function retryUploads() {
  for (const [id, task] of retries) {
    retries.delete(id);
    if (jobs.find(j => j.id === id)?.status !== 'error') continue;
    update(id, { status: 'waiting', retry: false, error: undefined });
    queue.push(task);
  }
  pump();
}

if (typeof window !== 'undefined') addEventListener('online', retryUploads);
