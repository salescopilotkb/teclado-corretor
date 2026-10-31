/**
 * Dados do Locker web: as mesmas tabelas do app e do teclado (supabase/locker.sql),
 * lidas direto do Supabase (a segurança RLS só entrega o que é da pessoa) e
 * atualizadas em tempo real quando algo muda no app, no teclado ou em outra aba.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../src/config/supabase';
import { LOCKER_PLANS, isLockerPlan } from '../../src/files/limits';
import type { LockerPlanId } from '../../src/files/limits';
import { demoData, demoUsage, PREVIEW } from './demo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // O botão "Abrir" do app chega com a sessão no endereço (link de uso único)
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export type Visibility = 'private' | 'link' | 'public';

/** Endereço do Locker web (os links públicos sempre usam este, também em testes locais). */
export const LOCKER_URL = 'https://locker.keyconapp.com';

/** Link permanente: /f/<código> (arquivo, abre sem login) ou /d/<código> (pasta com link ou pública). */
export const lockerLink = (kind: 'f' | 'd', token: string) => `${LOCKER_URL}/${kind}/${token}`;

export type LockerFolder = {
  id: string;
  /** Dono (outra conta = compartilhado com a pessoa). */
  user_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  in_keyboard: boolean;
  starred: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
  visibility: Visibility;
  share_token: string;
};

export type LockerFile = {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  kind: string;
  mime: string;
  size_bytes: number;
  storage: 'r2' | 'supabase' | 'link';
  object_key: string;
  url: string;
  duration: string | null;
  position: number;
  in_keyboard: boolean;
  starred: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
  share_token: string;
};

export type LockerData = { folders: LockerFolder[]; files: LockerFile[] };

export type Usage = { used: number; limit: number | null; plan: LockerPlanId };

/** Tudo da pessoa, também o que está na lixeira (a tela filtra). O compartilhado com ela vem em fetchShared. */
export async function fetchLocker(userId: string): Promise<LockerData> {
  if (PREVIEW) return demoData();
  const [folders, files] = await Promise.all([
    supabase.from('locker_folders').select('*').eq('user_id', userId),
    supabase.from('locker_files').select('*').eq('user_id', userId),
  ]);
  if (folders.error) throw folders.error;
  if (files.error) throw files.error;
  return { folders: (folders.data ?? []) as LockerFolder[], files: (files.data ?? []) as LockerFile[] };
}

/** Espaço usado e o plano (RPC locker_usage; sem resposta, soma o que está na tela). */
export async function fetchUsage(data: LockerData): Promise<Usage> {
  if (PREVIEW) return demoUsage();
  const { data: rows, error } = await supabase.rpc('locker_usage');
  const row = (Array.isArray(rows) ? rows[0] : rows) as { used_bytes: number; limit_bytes: number; plan: string } | null;
  if (!error && row) {
    const plan = isLockerPlan(row.plan) ? row.plan : 'basic';
    return { used: Number(row.used_bytes) || 0, limit: Number(row.limit_bytes) || LOCKER_PLANS[plan].bytes, plan };
  }
  return { used: data.files.reduce((sum, f) => sum + (Number(f.size_bytes) || 0), 0), limit: LOCKER_PLANS.basic.bytes, plan: 'basic' };
}

/**
 * Avisa quando algo muda nas tabelas do Locker (app, teclado ou outra aba).
 * Várias mudanças seguidas viram um aviso só. Devolve a função que para de ouvir.
 */
export function watchLocker(userId: string, onChange: () => void): () => void {
  if (PREVIEW) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ping = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  const channel = supabase
    .channel(`locker-web-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locker_folders', filter: `user_id=eq.${userId}` }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locker_files', filter: `user_id=eq.${userId}` }, ping)
    .subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

/** Chama a função "locker" (R2): devolve os dados ou o código do erro. */
export async function callLocker(body: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; status: number; error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('locker', { body });
    if (!error) return { ok: true, data };
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

// -----------------------------------------------------------------------------
// Links de download do R2: o que está na tabela vale 7 dias. Vencido (ou perto),
// pede um novo para a função "locker" e guarda nesta aba.
// -----------------------------------------------------------------------------
const signed = new Map<string, { url: string; until: number }>();

/** Quando o link assinado do R2 vence (X-Amz-Date + X-Amz-Expires), em ms. */
function expiresAt(url: string): number {
  try {
    const q = new URL(url).searchParams;
    const date = q.get('X-Amz-Date');
    const secs = Number(q.get('X-Amz-Expires'));
    if (!date || !secs) return Infinity;
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`;
    return Date.parse(iso) + secs * 1000;
  } catch {
    return 0;
  }
}

const MARGIN = 10 * 60 * 1000;

/** Cópias guardadas para usar sem internet (id do arquivo → blob:), ver offline.ts. */
export const localCopies = new Map<string, string>();

/** Endereço que abre agora: a cópia deste aparelho, se houver; senão o link do R2 (renovado se precisar). */
export async function fileUrl(file: LockerFile): Promise<string> {
  return localCopies.get(file.id) ?? signedUrl(file);
}

/** Link da nuvem (renova o link do R2 se precisar). */
export async function signedUrl(file: LockerFile): Promise<string> {
  if (file.storage !== 'r2' || !file.object_key) return file.url;
  if (file.url && expiresAt(file.url) - MARGIN > Date.now()) return file.url;
  const cached = signed.get(file.object_key);
  if (cached && cached.until - MARGIN > Date.now()) return cached.url;
  const { data, error } = await supabase.functions.invoke('locker', { body: { action: 'sign', keys: [file.object_key] } });
  const url: string | undefined = data?.urls?.[file.object_key];
  if (error || !url) return file.url;
  signed.set(file.object_key, { url, until: expiresAt(url) });
  return url;
}

/** O link de agora, sem esperar (para miniaturas): vale o da tabela ou o já renovado. */
export function fileUrlNow(file: LockerFile): string {
  const local = localCopies.get(file.id);
  if (local) return local;
  const cached = file.object_key ? signed.get(file.object_key) : undefined;
  return cached?.url ?? file.url;
}

// -----------------------------------------------------------------------------
// Tipos de arquivo (para ícones, filtros da busca e a prévia)
// -----------------------------------------------------------------------------
export type FileType = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'other';

const DOC_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|odp|txt|csv|rtf|pages|numbers|key)$/i;

export function fileType(f: Pick<LockerFile, 'mime' | 'kind' | 'name'>): FileType {
  const mime = f.mime || '';
  if (mime.startsWith('image/') || (!mime && f.kind === 'image')) return 'image';
  if (mime.startsWith('video/') || (!mime && f.kind === 'video')) return 'video';
  if (mime.startsWith('audio/') || f.kind === 'audio') return 'audio';
  if (mime === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
  if (mime.startsWith('text/') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') || mime.includes('msword') || DOC_EXT.test(f.name)) return 'document';
  return 'other';
}
