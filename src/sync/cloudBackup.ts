/**
 * Cópia na nuvem dos dados do app: produtos (pastas), atalhos de texto, áudio e
 * link, agenda, clientes do CRM e etiquetas. Fica no Cloudflare R2 (Edge Function
 * "backup", supabase/functions/backup), em um JSON por conta.
 *
 *  - O app e o teclado continuam lendo e gravando no aparelho (Repo): funciona sem
 *    internet e o teclado abre na hora. Este módulo só acompanha as mudanças.
 *  - Mudou algo (no app ou no teclado), a cópia sobe alguns segundos depois. Ao abrir
 *    o app (ou o teclado), baixa a cópia e junta com o que está no aparelho.
 *  - A junção é item por item: cada item guarda quando mudou pela última vez e cada
 *    exclusão fica marcada (por 180 dias). Vale a mudança mais nova, então dois
 *    aparelhos mexendo em itens diferentes não apagam o trabalho um do outro.
 *  - Reinstalou o app ou entrou em outro aparelho: o aparelho está vazio e sem
 *    marcas, então nada conta como excluído e a cópia da nuvem volta inteira.
 *
 * Sem a função publicada ou sem as chaves do R2, nada muda: os dados ficam só no
 * aparelho, como antes, e sobem quando a nuvem for ligada.
 *
 * As datas das mudanças e as exclusões ficam em "backup.meta" (apagado junto com os
 * dados ao trocar de conta: Repo.clearUserData).
 */
import { AppState } from 'react-native';
import { DEMO_MODE } from '../config/demo';
import { supabase } from '../services/supabase';
import { BACKED_UP_KEYS, Repo, storage } from '../storage/storage';
import type { ShortcutsData } from '../types';

const FUNCTION = 'backup';
const META_KEY = 'backup.meta';
const VERSION = 1;
/** Espera as mudanças pararem antes de subir (digitando, arrastando...). */
const PUSH_DELAY_MS = 4000;
/** Baixa a cópia no máximo uma vez por minuto (o teclado abre muitas vezes). */
const PULL_EVERY_MS = 60 * 1000;
/** Exclusões ficam marcadas por 180 dias (um aparelho parado esse tempo não traz o item de volta). */
const DELETED_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** Outro aparelho gravou no meio: baixa, junta e tenta de novo até este número de vezes. */
const MAX_ATTEMPTS = 3;

// ── O que vai para a nuvem ─────────────────────────────────────────────────

type Item = { id: string };

interface Collection {
  read(): Item[];
  write(list: Item[]): void;
}

const shortcutsList = (field: keyof ShortcutsData): Collection => ({
  read: () => Repo.getShortcuts()[field],
  write: list => Repo.setShortcuts({ ...Repo.getShortcuts(), [field]: list }),
});

/** Etiquetas: cada uma é um item (id = nome em minúsculas). */
type TagItem = Item & { tag: string };

const COLLECTIONS = {
  folders: { read: () => Repo.getFolders(), write: list => Repo.setFolders(list as never) } as Collection,
  texts: shortcutsList('texts'),
  audios: shortcutsList('audios'),
  links: shortcutsList('links'),
  agenda: { read: () => Repo.getAgenda(), write: list => Repo.setAgenda(list as never) } as Collection,
  crm: { read: () => Repo.getCRM(), write: list => Repo.setCRM(list as never) } as Collection,
  tags: {
    read: () => {
      const seen = new Set<string>();
      const out: TagItem[] = [];
      for (const tag of Repo.getCrmTags()) {
        const id = tag.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ id, tag });
      }
      return out;
    },
    write: list => Repo.setCrmTags((list as TagItem[]).map(x => x.tag).filter(x => typeof x === 'string' && x.trim())),
  } as Collection,
};
type CollectionName = keyof typeof COLLECTIONS;
const NAMES = Object.keys(COLLECTIONS) as CollectionName[];

// ── Formatos ───────────────────────────────────────────────────────────────

/** Item na nuvem: t = quando mudou pela última vez (ms); d = o próprio item. */
interface CloudItem {
  id: string;
  t: number;
  d: Item;
}
interface CloudCollection {
  items: CloudItem[];
  /** id → quando foi excluído (ms). */
  deleted: Record<string, number>;
}
interface CloudSnapshot {
  v: number;
  savedAt: number;
  collections: Partial<Record<CollectionName, CloudCollection>>;
}

/** O que o aparelho sabe de cada item: h = resumo do conteúdo; t = quando mudou. */
interface Meta {
  userId: string;
  items: Partial<Record<CollectionName, Record<string, { h: number; t: number }>>>;
  deleted: Partial<Record<CollectionName, Record<string, number>>>;
}

function readMeta(userId: string): Meta {
  try {
    const raw = storage.getString(META_KEY);
    const meta = raw ? (JSON.parse(raw) as Meta) : null;
    // Marcas de outra conta não valem para esta
    if (meta && meta.userId === userId && meta.items && meta.deleted) return meta;
  } catch {
    // marcas estragadas: recomeça (nada conta como excluído)
  }
  return { userId, items: {}, deleted: {} };
}

const saveMeta = (meta: Meta) => storage.set(META_KEY, JSON.stringify(meta));

/** Resumo curto do conteúdo (FNV-1a): diz se o item mudou desde a última vez. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const isItem = (x: unknown): x is Item => !!x && typeof x === 'object' && typeof (x as Item).id === 'string' && !!(x as Item).id;

/** Lê a cópia da nuvem, descartando o que não tiver o formato certo. */
function parseSnapshot(data: unknown): CloudSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const snap = data as Partial<CloudSnapshot>;
  if (snap.v !== VERSION || !snap.collections || typeof snap.collections !== 'object') return null;
  const collections: CloudSnapshot['collections'] = {};
  for (const name of NAMES) {
    const c = (snap.collections as Record<string, Partial<CloudCollection> | undefined>)[name];
    if (!c) continue;
    const items = (Array.isArray(c.items) ? c.items : []).filter(
      (x): x is CloudItem => !!x && typeof x.id === 'string' && typeof x.t === 'number' && isItem(x.d) && x.d.id === x.id,
    );
    const deleted: Record<string, number> = {};
    for (const [id, t] of Object.entries(c.deleted && typeof c.deleted === 'object' ? c.deleted : {})) {
      if (typeof t === 'number') deleted[id] = t;
    }
    collections[name] = { items, deleted };
  }
  return { v: VERSION, savedAt: Number(snap.savedAt) || 0, collections };
}

// ── Junção ─────────────────────────────────────────────────────────────────

/** Anota no meta o que mudou no aparelho desde a última vez (novo, alterado, excluído). */
function stamp(meta: Meta, lists: Record<CollectionName, Item[]>, now: number): void {
  for (const name of NAMES) {
    const known = (meta.items[name] ??= {});
    const deleted = (meta.deleted[name] ??= {});
    const seen = new Set<string>();
    for (const item of lists[name]) {
      if (!isItem(item) || seen.has(item.id)) continue;
      seen.add(item.id);
      const h = hash(JSON.stringify(item));
      const prev = known[item.id];
      if (!prev || prev.h !== h) known[item.id] = { h, t: now };
      delete deleted[item.id];
    }
    // Estava no aparelho e sumiu: foi excluído aqui
    for (const id of Object.keys(known)) {
      if (!seen.has(id)) {
        deleted[id] = now;
        delete known[id];
      }
    }
  }
}

interface Merged {
  list: Item[];
  cloud: CloudCollection;
}

/** Junta o aparelho com a nuvem: em cada item vence a mudança (ou exclusão) mais nova. */
function mergeCollection(local: Item[], meta: Meta, name: CollectionName, remote: CloudCollection | undefined, now: number): Merged {
  type Pick = { t: number; d: Item | null };
  const best = new Map<string, Pick>();
  const offer = (id: string, t: number, d: Item | null) => {
    const cur = best.get(id);
    // Empate: fica o que chegou antes (o do aparelho)
    if (!cur || t > cur.t) best.set(id, { t, d });
  };
  const known = meta.items[name] ?? {};
  const localDeleted = meta.deleted[name] ?? {};
  const localById = new Map<string, Item>();
  for (const item of local) {
    if (!isItem(item) || localById.has(item.id)) continue;
    localById.set(item.id, item);
    offer(item.id, known[item.id]?.t ?? now, item);
  }
  for (const [id, t] of Object.entries(localDeleted)) offer(id, t, null);
  for (const x of remote?.items ?? []) offer(x.id, x.t, x.d);
  for (const [id, t] of Object.entries(remote?.deleted ?? {})) offer(id, t, null);

  // Ordem: a do aparelho; o que veio só da nuvem entra depois do item que vinha antes dele lá
  const order: string[] = [...localById.keys()].filter(id => best.get(id)?.d);
  const placed = new Set(order);
  let previous: string | null = null;
  for (const x of remote?.items ?? []) {
    if (!placed.has(x.id) && best.get(x.id)?.d) {
      const at = previous === null ? 0 : order.indexOf(previous) + 1;
      order.splice(at, 0, x.id);
      placed.add(x.id);
    }
    if (placed.has(x.id)) previous = x.id;
  }

  const deleted: Record<string, number> = {};
  for (const [id, pick] of best) {
    if (!pick.d && now - pick.t < DELETED_TTL_MS) deleted[id] = pick.t;
  }
  const items = order.map(id => {
    const pick = best.get(id)!;
    return { id, t: pick.t, d: pick.d! };
  });
  return { list: items.map(x => x.d), cloud: { items, deleted } };
}

/** Assinatura da coleção (ids, ordem e datas): igual = não precisa subir de novo. */
function signature(c: CloudCollection | undefined): string {
  if (!c) return '|';
  const items = c.items.map(x => `${x.id}:${x.t}`).join(',');
  const deleted = Object.entries(c.deleted)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, t]) => `${id}:${t}`)
    .join(',');
  return `${items}|${deleted}`;
}

const emptyCollection = (c: CloudCollection) => c.items.length === 0 && Object.keys(c.deleted).length === 0;

// ── Chamadas à Edge Function ───────────────────────────────────────────────

type Reply<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function callBackup<T>(body: Record<string, unknown>): Promise<Reply<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(FUNCTION, { body });
    if (!error) return { ok: true, data: data as T };
    const context = (error as { context?: Response }).context;
    let code = '';
    try {
      code = String((await context?.json())?.error ?? '');
    } catch {
      // sem corpo JSON (função não publicada, sem internet)
    }
    return { ok: false, status: context?.status ?? 0, error: code || error.message || 'failed' };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'failed' };
  }
}

// ── Sincronização ──────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
/** true enquanto grava no aparelho o que veio da nuvem (não conta como mudança local). */
let applying = false;

function readLists(): Record<CollectionName, Item[]> {
  const lists = {} as Record<CollectionName, Item[]>;
  for (const name of NAMES) lists[name] = COLLECTIONS[name].read();
  return lists;
}

/** A sessão ainda é da mesma conta que é dona dos dados do aparelho? */
async function currentUser(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  return userId && Repo.getUserId() === userId ? userId : null;
}

/** Baixa, junta e sobe. Sem login, sem internet ou sem a nuvem ligada: não faz nada. */
async function doSync(): Promise<void> {
  if (DEMO_MODE) return;
  const userId = await currentUser();
  if (!userId) return;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const now = Date.now();
    const lists = readLists();
    const meta = readMeta(userId);
    stamp(meta, lists, now);
    saveMeta(meta);
    const snapshotBefore = JSON.stringify(lists);

    const got = await callBackup<{ data: unknown; etag: string | null }>({ action: 'get' });
    if (!got.ok) return; // nuvem não ligada ou sem internet: tenta de novo na próxima mudança/abertura
    lastPull = Date.now();
    // Trocou de conta enquanto baixava: o que veio não é desta
    if ((await currentUser()) !== userId) return;
    // Cópia gravada por uma versão mais nova do app: não mexe (atualize o app)
    const version = (got.data.data as { v?: unknown } | null)?.v;
    if (typeof version === 'number' && version > VERSION) return;
    const remote = parseSnapshot(got.data.data);

    const merged = {} as Record<CollectionName, Merged>;
    for (const name of NAMES) merged[name] = mergeCollection(lists[name], meta, name, remote?.collections[name], now);

    // Mudou algo no aparelho enquanto baixava: recomeça com a versão nova
    if (JSON.stringify(readLists()) !== snapshotBefore) continue;

    let localChanged = false;
    applying = true;
    try {
      for (const name of NAMES) {
        if (JSON.stringify(merged[name].list) !== JSON.stringify(lists[name])) {
          COLLECTIONS[name].write(merged[name].list);
          localChanged = true;
        }
      }
    } finally {
      applying = false;
    }

    // O aparelho passa a saber a data de cada item (e as exclusões que vieram da nuvem)
    const fresh = readLists();
    const next: Meta = { userId, items: {}, deleted: {} };
    for (const name of NAMES) {
      const times = new Map(merged[name].cloud.items.map(x => [x.id, x.t]));
      const items: Record<string, { h: number; t: number }> = {};
      for (const item of fresh[name]) {
        if (isItem(item)) items[item.id] = { h: hash(JSON.stringify(item)), t: times.get(item.id) ?? now };
      }
      next.items[name] = items;
      next.deleted[name] = { ...merged[name].cloud.deleted };
    }
    saveMeta(next);
    if (localChanged) listeners.forEach(cb => cb());

    // A nuvem já tem tudo isso: não sobe de novo
    const remoteChanged = NAMES.some(name => {
      const mine = merged[name].cloud;
      const theirs = remote?.collections[name];
      return theirs ? signature(mine) !== signature(theirs) : !emptyCollection(mine);
    });
    if (!remoteChanged) return;

    const collections: CloudSnapshot['collections'] = {};
    for (const name of NAMES) collections[name] = merged[name].cloud;
    const snapshot: CloudSnapshot = { v: VERSION, savedAt: Date.now(), collections };
    const put = await callBackup<{ etag: string | null }>({ action: 'put', data: snapshot, etag: got.data.etag });
    if (put.ok) return;
    if (put.error !== 'conflict') return; // sem internet: sobe na próxima vez (as datas já estão guardadas)
    // Outro aparelho gravou no meio: baixa de novo e junta
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Uma sincronização por vez; pedidos no meio viram uma rodada a mais no fim. */
function sync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await doSync().catch(() => {});
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPull = 0;

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    sync();
  }, PUSH_DELAY_MS);
}

/** Sobe agora o que estava esperando (app indo para o fundo). */
function flushPending() {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  sync();
}

/** Confere a nuvem (no máximo uma vez por minuto, salvo force). */
export function pullCloudBackup(force = false): Promise<void> {
  if (DEMO_MODE) return Promise.resolve();
  if (!force && Date.now() - lastPull < PULL_EVERY_MS) return Promise.resolve();
  return sync();
}

/** Chamado quando o que veio da nuvem mudou os dados do aparelho (para recarregar a tela). */
export function onCloudBackupChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let users = 0;
let stopWatching: (() => void) | null = null;

/**
 * Liga a cópia na nuvem (app logado, teclado aberto). Pode ser chamada por mais de
 * uma tela: só desliga quando a última sair.
 */
export function startCloudBackup(): () => void {
  if (DEMO_MODE) return () => {};
  users++;
  if (users === 1) {
    const changes = storage.addOnValueChangedListener(key => {
      if (!applying && BACKED_UP_KEYS.includes(key)) schedulePush();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') pullCloudBackup();
      else flushPending();
    });
    stopWatching = () => {
      changes.remove();
      appState.remove();
    };
  }
  pullCloudBackup(true);
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0 && stopWatching) {
      flushPending();
      stopWatching();
      stopWatching = null;
    }
  };
}
