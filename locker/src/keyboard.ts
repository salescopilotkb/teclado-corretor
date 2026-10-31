/**
 * O Locker como ele aparece no teclado: o que está marcado "no teclado" e em que
 * ordem. As regras são as mesmas do app (keyboardView, subfolders e filesIn em
 * src/files/files.ts): a ordem escolhida (position 1, 2, 3...) vem primeiro; o que
 * nunca foi reordenado (position 0) vem depois, pastas por nome e arquivos do mais
 * novo para o mais antigo. Uma pasta fora do teclado leva junto o que tem dentro.
 */
import { supabase } from './data';
import type { LockerData, LockerFile, LockerFolder } from './data';

const byPosition = (a: { position: number }, b: { position: number }) => (a.position > 0 ? a.position : Infinity) - (b.position > 0 ? b.position : Infinity) || 0;
const byName = (a: LockerFolder, b: LockerFolder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export type KeyboardLevel = {
  folders: LockerFolder[];
  files: LockerFile[];
  /** Fora do teclado neste nível (continuam no Locker). */
  hiddenFolders: LockerFolder[];
  hiddenFiles: LockerFile[];
};

export function keyboardLevel(data: LockerData, parentId: string | null): KeyboardLevel {
  const folders = data.folders
    .filter(f => f.parent_id === parentId && !f.trashed_at)
    .sort((a, b) => byPosition(a, b) || byName(a, b));
  const files = data.files
    .filter(f => f.folder_id === parentId && !f.trashed_at)
    .sort((a, b) => byPosition(a, b) || b.created_at.localeCompare(a.created_at));
  return {
    folders: folders.filter(f => f.in_keyboard !== false),
    files: files.filter(f => f.in_keyboard !== false),
    hiddenFolders: folders.filter(f => f.in_keyboard === false),
    hiddenFiles: files.filter(f => f.in_keyboard === false),
  };
}

/** A pasta (ou uma acima dela) está fora do teclado: nada dela aparece lá. */
export function hiddenInKeyboard(data: LockerData, folderId: string | null): boolean {
  const byId = new Map(data.folders.map(f => [f.id, f]));
  for (let id = folderId, guard = 0; id && guard < 64; guard++) {
    const f = byId.get(id);
    if (!f) return false;
    if (f.in_keyboard === false) return true;
    id = f.parent_id;
  }
  return false;
}

/** Grava a ordem nova do nível (1, 2, 3...): só o que mudou de lugar. */
export async function saveOrder(table: 'locker_folders' | 'locker_files', ordered: Array<{ id: string; position: number }>) {
  const changed = ordered.map((item, i) => ({ id: item.id, position: i + 1, before: item.position })).filter(i => i.position !== i.before);
  const results = await Promise.all(changed.map(c => supabase.from(table).update({ position: c.position }).eq('id', c.id)));
  if (results.some(r => r.error)) throw new Error('save_failed');
}

export async function setInKeyboard(sel: { folders: LockerFolder[]; files: LockerFile[] }, shown: boolean) {
  const results = await Promise.all([
    sel.folders.length ? supabase.from('locker_folders').update({ in_keyboard: shown }).in('id', sel.folders.map(f => f.id)) : null,
    sel.files.length ? supabase.from('locker_files').update({ in_keyboard: shown }).in('id', sel.files.map(f => f.id)) : null,
  ]);
  if (results.some(r => r?.error)) throw new Error('save_failed');
}
