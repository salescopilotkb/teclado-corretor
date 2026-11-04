/**
 * Demonstração no navegador (keyconapp.com/app, só do admin): as fotos, vídeos e
 * áudios que o admin envia ficam guardados NESTE navegador (IndexedDB, bem mais espaço
 * que o armazenamento comum) e voltam quando a página é aberta de novo. Nada vai ao
 * servidor. O arquivo é marcado com storagePath "demo:<id>"; ao abrir a página,
 * web/main.tsx (start) cria os links de novo (os links "blob:" valem só por uma visita).
 */
const DB = 'keycon-demo-media';
const STORE = 'files';
export const DEMO_MEDIA_PREFIX = 'demo:';

// Tipos do navegador (o TypeScript do app é o do React Native, sem os do DOM)
/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;
type Store = any;
type Req<T> = { result: T; error: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null };
const idb = (): any => (globalThis as any).indexedDB;
const hasIDB = () => !!idb();

function open(): Promise<Db> {
  return new Promise((resolve, reject) => {
    const req = idb().open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: 'readonly' | 'readwrite', fn: (store: Store) => Req<T>): Promise<T> {
  return open().then(
    (db: Db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Guarda o arquivo enviado na demonstração. Devolve o storagePath ("" se o navegador não deixar). */
export async function saveDemoMedia(blob: Blob): Promise<string> {
  if (!hasIDB()) return '';
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    await run('readwrite', s => s.put(blob, id));
    return DEMO_MEDIA_PREFIX + id;
  } catch {
    return '';
  }
}

export async function deleteDemoMedia(storagePath: string): Promise<void> {
  if (!hasIDB() || !storagePath.startsWith(DEMO_MEDIA_PREFIX)) return;
  try {
    await run('readwrite', s => s.delete(storagePath.slice(DEMO_MEDIA_PREFIX.length)));
  } catch {
    // já não estava lá
  }
}

/** Todos os arquivos guardados: id → link novo desta visita. */
export async function demoMediaUrls(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!hasIDB()) return out;
  try {
    const keys = (await run('readonly', s => s.getAllKeys())) as string[];
    for (const key of keys) {
      const blob = (await run('readonly', s => s.get(key))) as Blob | undefined;
      if (blob) out.set(DEMO_MEDIA_PREFIX + key, URL.createObjectURL(blob));
    }
  } catch {
    // sem acesso: os arquivos enviados não voltam (o resto da demonstração funciona)
  }
  return out;
}

/** "Recomeçar a demonstração": apaga tudo o que foi enviado. */
export async function clearDemoMedia(): Promise<void> {
  if (!hasIDB()) return;
  try {
    await run('readwrite', s => s.clear());
  } catch {
    // nada a apagar
  }
}

/** Troca, em qualquer objeto, o link antigo pelo novo dos que têm storagePath "demo:...". */
export function relinkDemoMedia(value: unknown, urls: Map<string, string>): boolean {
  let changed = false;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    const path = o.storagePath;
    if (typeof path === 'string' && urls.has(path)) {
      const url = urls.get(path)!;
      for (const field of ['url', 'uri']) {
        if (typeof o[field] === 'string' && o[field] !== url) {
          o[field] = url;
          changed = true;
        }
      }
    }
    Object.values(o).forEach(walk);
  };
  walk(value);
  return changed;
}
