/**
 * Uso sem internet (como o "Disponível off-line" do Drive):
 *  - a página fica guardada pelo service worker (public/sw.js);
 *  - a última cópia da organização (pastas, nomes, tamanhos) fica guardada aqui e
 *    aparece quando a internet cai;
 *  - os arquivos que a pessoa marca "Disponível sem internet" ficam guardados no
 *    navegador e abrem, tocam e baixam mesmo sem conexão.
 * Tudo no Cache Storage do navegador (bem mais espaço que o localStorage).
 * Ao sair da conta, apaga tudo deste aparelho.
 */
import { useEffect, useState } from 'react';
import { localCopies, signedUrl } from './data';
import type { LockerData, LockerFile, Usage } from './data';
import type { SharedData } from './sharing';

const CACHE = 'locker-offline-v1';
const hasCaches = typeof caches !== 'undefined';

/** Está com internet? (muda sozinho quando a conexão cai ou volta) */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// -----------------------------------------------------------------------------
// Última cópia da organização
// -----------------------------------------------------------------------------
export type Snapshot = { data: LockerData; shared: SharedData; usage: Usage | null; savedAt: string };

const snapshotKey = (userId: string) => `/locker-offline/${userId}/snapshot.json`;

export async function saveSnapshot(userId: string, snap: Omit<Snapshot, 'savedAt'>) {
  if (!hasCaches) return;
  try {
    const cache = await caches.open(CACHE);
    await cache.put(snapshotKey(userId), new Response(JSON.stringify({ ...snap, savedAt: new Date().toISOString() }), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    // sem espaço ou navegador em modo privado: segue sem a cópia
  }
}

export async function loadSnapshot(userId: string): Promise<Snapshot | null> {
  if (!hasCaches) return null;
  try {
    const res = await (await caches.open(CACHE)).match(snapshotKey(userId));
    return res ? ((await res.json()) as Snapshot) : null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Arquivos disponíveis sem internet
// -----------------------------------------------------------------------------
/** O que está guardado: o id e a versão (object_key) do arquivo. */
type Saved = Record<string, { key: string; name: string }>;

const listKey = (userId: string) => `locker.offline.${userId}`;
const fileKey = (userId: string, id: string) => `/locker-offline/${userId}/files/${encodeURIComponent(id)}`;

export function offlineList(userId: string): Saved {
  try {
    return JSON.parse(localStorage.getItem(listKey(userId)) || '{}') as Saved;
  } catch {
    return {};
  }
}

function writeList(userId: string, list: Saved) {
  localStorage.setItem(listKey(userId), JSON.stringify(list));
}

/** Prepara os links locais (blob:) do que já está guardado, para as miniaturas e a prévia. */
export async function loadLocalCopies(userId: string): Promise<void> {
  if (!hasCaches) return;
  try {
    const cache = await caches.open(CACHE);
    for (const id of Object.keys(offlineList(userId))) {
      if (localCopies.has(id)) continue;
      const res = await cache.match(fileKey(userId, id));
      if (res) localCopies.set(id, URL.createObjectURL(await res.blob()));
    }
  } catch {
    // Navegador sem acesso ao armazenamento (janela anônima, por exemplo): segue sem as cópias
  }
}

/**
 * Guarda os arquivos neste navegador. Devolve quantos deram certo.
 * `onProgress` conta os arquivos (feito, total).
 */
export async function makeOffline(userId: string, files: LockerFile[], onProgress?: (done: number, total: number) => void): Promise<number> {
  if (!hasCaches) throw new Error('no_cache');
  // Pede ao navegador para não apagar sozinho quando faltar espaço
  navigator.storage?.persist?.().catch(() => undefined);
  const cache = await caches.open(CACHE);
  const list = offlineList(userId);
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const f = files[i];
    try {
      const res = await fetch(await signedUrl(f));
      if (!res.ok) continue;
      const blob = await res.blob();
      await cache.put(fileKey(userId, f.id), new Response(blob, { headers: { 'Content-Type': f.mime || blob.type || 'application/octet-stream' } }));
      const old = localCopies.get(f.id);
      if (old) URL.revokeObjectURL(old);
      localCopies.set(f.id, URL.createObjectURL(blob));
      list[f.id] = { key: f.object_key || f.url, name: f.name };
      ok++;
    } catch {
      // sem conexão no meio: os outros seguem
    }
  }
  writeList(userId, list);
  onProgress?.(files.length, files.length);
  return ok;
}

export async function removeOffline(userId: string, ids: string[]) {
  const list = offlineList(userId);
  const cache = hasCaches ? await caches.open(CACHE).catch(() => null) : null;
  for (const id of ids) {
    delete list[id];
    await cache?.delete(fileKey(userId, id));
    const url = localCopies.get(id);
    if (url) URL.revokeObjectURL(url);
    localCopies.delete(id);
  }
  writeList(userId, list);
}

/**
 * Com internet: atualiza o que mudou (arquivo trocado por uma versão nova) e tira o
 * que foi apagado. Devolve true se mudou algo.
 */
export async function refreshOffline(userId: string, all: LockerFile[]): Promise<boolean> {
  const list = offlineList(userId);
  const ids = Object.keys(list);
  if (!ids.length) return false;
  const byId = new Map(all.map(f => [f.id, f]));
  const gone = ids.filter(id => !byId.has(id) || byId.get(id)!.trashed_at);
  const changed = ids.map(id => byId.get(id)).filter((f): f is LockerFile => !!f && !f.trashed_at && list[f.id].key !== (f.object_key || f.url));
  if (gone.length) await removeOffline(userId, gone);
  if (changed.length) await makeOffline(userId, changed);
  return gone.length > 0 || changed.length > 0;
}

/** Ao sair da conta: nada desta conta fica neste aparelho. */
export async function clearOffline(userId: string) {
  localStorage.removeItem(listKey(userId));
  localCopies.forEach(url => URL.revokeObjectURL(url));
  localCopies.clear();
  if (!hasCaches) return;
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    await Promise.all(keys.filter(r => new URL(r.url).pathname.startsWith(`/locker-offline/${userId}/`)).map(r => cache.delete(r)));
  } catch {
    // nada guardado (ou sem acesso): nada a apagar
  }
}
