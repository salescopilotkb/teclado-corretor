/**
 * Ações do Locker web sobre o que está selecionado: renomear, mover, fazer uma
 * cópia, baixar, estrela, lixeira (e restaurar) e excluir para sempre.
 *
 * Tudo grava direto nas tabelas (o app e o teclado recebem em tempo real). Lixeira:
 * só marca trashed_at no que foi escolhido; o que está dentro de uma pasta vai junto
 * com ela, sem ser marcado (restaurar a pasta traz tudo de volta). Depois de 30 dias,
 * a função locker-purge apaga de vez.
 */
import { t } from '../../src/i18n';
import { callLocker, fileUrl, supabase } from './data';
import type { LockerData, LockerFile, LockerFolder } from './data';
import { makeZip } from './zip';
import type { ZipEntry } from './zip';

export type Selection = { folders: LockerFolder[]; files: LockerFile[] };

const ids = <T extends { id: string }>(list: T[]) => list.map(i => i.id);

async function check(result: PromiseLike<{ error: unknown }>) {
  const { error } = await result;
  if (error) throw new Error(t('Não foi possível salvar. Confira a internet e tente de novo.'));
}

/** Subpastas e arquivos dentro das pastas (em qualquer nível). */
export function descendants(folders: LockerFolder[], data: LockerData): Selection {
  const children = new Map<string, LockerFolder[]>();
  for (const f of data.folders) if (f.parent_id) children.set(f.parent_id, [...(children.get(f.parent_id) ?? []), f]);
  const seen = new Set<string>();
  const stack = [...folders];
  const outFolders: LockerFolder[] = [];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    outFolders.push(f);
    stack.push(...(children.get(f.id) ?? []));
  }
  return { folders: outFolders, files: data.files.filter(f => f.folder_id && seen.has(f.folder_id)) };
}

export function rename(kind: 'folder' | 'file', id: string, name: string) {
  return check(supabase.from(kind === 'folder' ? 'locker_folders' : 'locker_files').update({ name }).eq('id', id));
}

export async function setStarred(sel: Selection, starred: boolean) {
  if (sel.folders.length) await check(supabase.from('locker_folders').update({ starred }).in('id', ids(sel.folders)));
  if (sel.files.length) await check(supabase.from('locker_files').update({ starred }).in('id', ids(sel.files)));
}

/** Lixeira (trashed = true) ou de volta (false). */
export async function setTrashed(sel: Selection, trashed: boolean) {
  const trashed_at = trashed ? new Date().toISOString() : null;
  if (sel.folders.length) await check(supabase.from('locker_folders').update({ trashed_at }).in('id', ids(sel.folders)));
  if (sel.files.length) await check(supabase.from('locker_files').update({ trashed_at }).in('id', ids(sel.files)));
}

/** Mover para outra pasta (null = Meu Locker). Vai para o fim da ordem do teclado. */
export async function moveTo(sel: Selection, folderId: string | null) {
  if (sel.folders.length) await check(supabase.from('locker_folders').update({ parent_id: folderId, position: 0 }).in('id', ids(sel.folders)));
  if (sel.files.length) await check(supabase.from('locker_files').update({ folder_id: folderId, position: 0 }).in('id', ids(sel.files)));
}

/** A pasta (ou alguma das que vão junto) é o destino ou fica acima dele: não dá para mover. */
export function invalidMoveTarget(sel: Selection, target: string | null, data: LockerData): boolean {
  if (!target) return false;
  const inside = new Set(ids(descendants(sel.folders, data).folders));
  return inside.has(target);
}

const rand = () => Math.random().toString(36).slice(2, 6);

/** "Fazer uma cópia" (só arquivos, como no Drive): copia o arquivo de verdade. */
export async function copyFiles(files: LockerFile[]): Promise<void> {
  if (!files.length) return;
  const r2Keys = files.filter(f => f.storage === 'r2' && f.object_key).map(f => f.object_key);
  let copies: Record<string, string> = {};
  let urls: Record<string, string> = {};
  if (r2Keys.length) {
    const reply = await callLocker({ action: 'copy', keys: r2Keys });
    if (!reply.ok) {
      throw new Error(
        reply.error === 'quota_exceeded'
          ? t('Seu Locker está cheio. Libere espaço ou mude de plano para enviar mais arquivos.')
          : t('Não foi possível fazer a cópia. Tente de novo.'),
      );
    }
    copies = reply.data?.copies ?? {};
    const signed = await callLocker({ action: 'sign', keys: Object.values(copies) });
    if (signed.ok) urls = signed.data?.urls ?? {};
  }

  const rows = [];
  for (const f of files) {
    let object_key = f.object_key;
    let url = f.url;
    if (f.storage === 'r2') {
      object_key = copies[f.object_key];
      if (!object_key) continue;
      url = urls[object_key] ?? '';
    } else if (f.storage === 'supabase' && f.object_key) {
      const ext = f.object_key.split('.').pop() ?? 'bin';
      const to = `${f.object_key.split('/')[0]}/${Date.now()}-${rand()}${rand()}.${ext}`;
      const { error } = await supabase.storage.from('media').copy(f.object_key, to);
      if (error) continue;
      object_key = to;
      url = supabase.storage.from('media').getPublicUrl(to).data.publicUrl;
    }
    rows.push({
      id: `file-${Date.now()}-${rand()}`,
      folder_id: f.folder_id,
      name: t('Cópia de {name}', { name: f.name }),
      kind: f.kind,
      mime: f.mime,
      size_bytes: f.size_bytes,
      storage: f.storage,
      object_key,
      url,
      duration: f.duration,
      in_keyboard: f.in_keyboard,
    });
  }
  if (!rows.length) throw new Error(t('Não foi possível fazer a cópia. Tente de novo.'));
  await check(supabase.from('locker_files').insert(rows));
}

/** Apaga de vez: os arquivos de verdade (R2 e bucket) e depois as linhas. */
export async function deleteForever(sel: Selection, data: LockerData) {
  const inside = descendants(sel.folders, data);
  const files = [...new Map([...sel.files, ...inside.files].map(f => [f.id, f])).values()];
  const r2Keys = files.filter(f => f.storage === 'r2' && f.object_key).map(f => f.object_key);
  for (let i = 0; i < r2Keys.length; i += 100) {
    const reply = await callLocker({ action: 'delete', keys: r2Keys.slice(i, i + 100) });
    if (!reply.ok && reply.error !== 'r2_not_configured') throw new Error(t('Não foi possível excluir. Confira a internet e tente de novo.'));
  }
  const bucketKeys = files.filter(f => f.storage === 'supabase' && f.object_key).map(f => f.object_key);
  for (let i = 0; i < bucketKeys.length; i += 100) await supabase.storage.from('media').remove(bucketKeys.slice(i, i + 100));
  for (let i = 0; i < files.length; i += 200) await check(supabase.from('locker_files').delete().in('id', ids(files.slice(i, i + 200))));
  // A pasta leva junto as subpastas (cascade)
  if (sel.folders.length) await check(supabase.from('locker_folders').delete().in('id', ids(sel.folders)));
}

// -----------------------------------------------------------------------------
// Baixar: um arquivo vai como ele é; vários (ou uma pasta) vão num .zip
// -----------------------------------------------------------------------------
const MAX_ZIP_BYTES = 1024 * 1024 * 1024;

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

async function bytesOf(file: LockerFile): Promise<Uint8Array> {
  const res = await fetch(await fileUrl(file));
  if (!res.ok) throw new Error(t('Não foi possível baixar "{name}".', { name: file.name }));
  return new Uint8Array(await res.arrayBuffer());
}

/** Caminho de cada arquivo dentro do zip, a partir da pasta escolhida. */
function pathInZip(file: LockerFile, roots: Set<string>, data: LockerData): string {
  const parts = [file.name || 'arquivo'];
  const byId = new Map(data.folders.map(f => [f.id, f]));
  for (let id = file.folder_id, guard = 0; id && guard < 64; guard++) {
    const f = byId.get(id);
    if (!f) break;
    parts.unshift(f.name || t('Sem nome'));
    if (roots.has(f.id)) break;
    id = f.parent_id;
  }
  return parts.join('/');
}

export async function download(sel: Selection, data: LockerData, onProgress: (done: number, total: number) => void) {
  if (sel.files.length === 1 && !sel.folders.length) {
    const file = sel.files[0];
    onProgress(0, 1);
    save(new Blob([await bytesOf(file)], { type: file.mime || 'application/octet-stream' }), file.name || 'arquivo');
    onProgress(1, 1);
    return;
  }
  const inside = descendants(sel.folders, data);
  const files = [...sel.files, ...inside.files.filter(f => !f.trashed_at)];
  if (!files.length) throw new Error(t('Não há arquivos para baixar.'));
  const total = files.reduce((sum, f) => sum + (Number(f.size_bytes) || 0), 0);
  if (total > MAX_ZIP_BYTES) throw new Error(t('Passa de 1 GB. Escolha menos arquivos para baixar de uma vez.'));

  const roots = new Set(ids(sel.folders));
  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress(i, files.length);
    const f = files[i];
    // Nome repetido: "foto (2).jpg"
    let path = f.folder_id && inside.files.includes(f) ? pathInZip(f, roots, data) : f.name || 'arquivo';
    for (let n = 2; used.has(path); n++) path = path.replace(/( \(\d+\))?(\.[^./]*)?$/, (_m, _n, ext = '') => ` (${n})${ext}`);
    used.add(path);
    entries.push({ path, data: await bytesOf(f), date: new Date(f.updated_at) });
  }
  onProgress(files.length, files.length);
  const name = sel.folders.length === 1 && !sel.files.length ? sel.folders[0].name || 'Locker' : `Locker-${new Date().toISOString().slice(0, 10)}`;
  save(makeZip(entries), `${name}.zip`);
}
