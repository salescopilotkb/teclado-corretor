/**
 * Supabase Edge Function: esvazia a lixeira do Locker depois do prazo do plano
 * (30 dias no free e no Basic, 60 no Plus, 90 no Pro: supabase/plans.sql).
 *
 * Roda uma vez por dia, chamada pelo agendador do banco (supabase/locker-purge.sql).
 * Apaga para sempre o que está na lixeira há mais tempo que o prazo: as linhas das tabelas
 * e os arquivos de verdade (no R2 e no bucket "media"). O que estava dentro de uma
 * pasta da lixeira vai junto com ela.
 *
 * Publicar (uma vez):
 *   supabase secrets set CRON_SECRET=<uma senha longa qualquer>
 *   supabase functions deploy locker-purge --no-verify-jwt
 *
 * Também cuida de quem passou do limite do plano (assinatura vencida ou plano
 * menor): depois de 30 dias (supabase/plans.sql, plan_scan_over_limit), saem os
 * arquivos mais RECENTES que passam do limite, pela data de envio; no plano grátis
 * o que fica vai para uma pasta só.
 *
 * Sem login de usuário: só aceita quem manda o cabeçalho x-cron-secret certo, e usa
 * a chave service_role (já existe nos segredos de toda Edge Function).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

/** O menor prazo (free e Basic); cada conta pode ter mais, conforme o plano. */
const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
/** Por execução: o que sobrar sai no dia seguinte. */
const MAX_FILES = 2000;

type Folder = { id: string; user_id: string; parent_id: string | null; trashed_at: string | null };
type File = { id: string; user_id: string; folder_id: string | null; storage: string; object_key: string; trashed_at: string | null };

Deno.serve(async req => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - TRASH_DAYS * DAY).toISOString();

  const { data: oldFolders, error: e1 } = await admin.from('locker_folders').select('id, user_id, parent_id, trashed_at').lt('trashed_at', cutoff);
  const { data: oldFiles, error: e2 } = await admin
    .from('locker_files')
    .select('id, user_id, folder_id, storage, object_key, trashed_at')
    .lt('trashed_at', cutoff)
    .limit(MAX_FILES);
  if (e1 || e2) return json({ error: 'query_failed' }, 500);

  // Prazo de cada conta (Plus e Pro guardam mais tempo)
  const days = new Map<string, number>();
  for (const userId of new Set([...(oldFolders ?? []), ...(oldFiles ?? [])].map(r => r.user_id as string))) {
    const { data } = await admin.rpc('plan_limits_of', { uid: userId });
    days.set(userId, Number((data as { trash_days?: number } | null)?.trash_days) || TRASH_DAYS);
  }
  const expired = (r: { user_id: string; trashed_at: string | null }) =>
    !!r.trashed_at && Date.parse(r.trashed_at) < Date.now() - (days.get(r.user_id) ?? TRASH_DAYS) * DAY;
  const expiredFolders = ((oldFolders ?? []) as Folder[]).filter(expired);
  const expiredFiles = ((oldFiles ?? []) as File[]).filter(expired);

  // Pastas vencidas e tudo o que está dentro delas (subpastas e arquivos)
  const folderIds = new Set<string>();
  const users = [...new Set((expiredFolders as Folder[]).map(f => f.user_id))];
  for (const userId of users) {
    const { data: all } = await admin.from('locker_folders').select('id, user_id, parent_id, trashed_at').eq('user_id', userId);
    const children = new Map<string, string[]>();
    for (const f of (all ?? []) as Folder[]) {
      if (!f.parent_id) continue;
      children.set(f.parent_id, [...(children.get(f.parent_id) ?? []), f.id]);
    }
    const stack = (expiredFolders as Folder[]).filter(f => f.user_id === userId).map(f => f.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (folderIds.has(id)) continue;
      folderIds.add(id);
      stack.push(...(children.get(id) ?? []));
    }
  }

  const files = new Map<string, File>(((expiredFiles ?? []) as File[]).map(f => [f.id, f]));
  const ids = [...folderIds];
  for (let i = 0; i < ids.length && files.size < MAX_FILES; i += 200) {
    const { data } = await admin.from('locker_files').select('id, user_id, folder_id, storage, object_key, trashed_at').in('folder_id', ids.slice(i, i + 200));
    for (const f of (data ?? []) as File[]) files.set(f.id, f);
  }

  // Os arquivos de verdade primeiro; a linha só sai se o arquivo saiu
  const r2 = r2FromEnv();
  const gone: string[] = [];
  const bucketKeys: string[] = [];
  for (const f of files.values()) {
    if (f.storage === 'r2' && f.object_key) {
      if (!r2) continue;
      const res = await r2.fetch(f.object_key, { method: 'DELETE' });
      if (res.ok || res.status === 404) gone.push(f.id);
    } else if (f.storage === 'supabase' && f.object_key) {
      bucketKeys.push(f.object_key);
      gone.push(f.id);
    } else {
      gone.push(f.id);
    }
  }
  for (let i = 0; i < bucketKeys.length; i += 100) await admin.storage.from('media').remove(bucketKeys.slice(i, i + 100));
  for (let i = 0; i < gone.length; i += 200) await admin.from('locker_files').delete().in('id', gone.slice(i, i + 200));

  // Pastas: apagar a pasta apaga o que está dentro (cascade). Se algum arquivo da pessoa
  // não saiu (R2 fora do ar, limite da execução), as pastas dela ficam para amanhã
  const goneSet = new Set(gone);
  const waiting = new Set([...files.values()].filter(f => !goneSet.has(f.id)).map(f => f.user_id));
  const topFolders = (expiredFolders as Folder[]).filter(f => !waiting.has(f.user_id) && files.size < MAX_FILES).map(f => f.id);
  for (let i = 0; i < topFolders.length; i += 200) await admin.from('locker_folders').delete().in('id', topFolders.slice(i, i + 200));

  // ── Passou do limite do plano há mais de 30 dias ──
  const overdue = await trimOverdue(admin, r2);

  return json({ files: gone.length, folders: topFolders.length, overdue });
});

type Row = { id: string; folder_id: string | null; storage: string; object_key: string; size_bytes: number; created_at: string };
type Dir = { id: string; parent_id: string | null; created_at: string };
type Limits = { limit_bytes: number | null; max_files: number | null; max_folders: number | null };

/** Para cada conta fora do prazo: fica o que é mais antigo até caber no plano; o resto sai. */
async function trimOverdue(admin: ReturnType<typeof createClient>, r2: ReturnType<typeof r2FromEnv>) {
  const { data: users, error } = await admin.rpc('plan_scan_over_limit');
  if (error || !users) return { error: error?.message ?? 'scan_failed' };
  let trimmed = 0;
  let removed = 0;
  for (const { overdue_user: userId } of users as { overdue_user: string }[]) {
    const { data: limits } = await admin.rpc('plan_limits_of', { uid: userId });
    const l = limits as Limits | null;
    if (!l) continue;
    const { data: fileRows } = await admin
      .from('locker_files')
      .select('id, folder_id, storage, object_key, size_bytes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(MAX_FILES);
    const { data: folderRows } = await admin
      .from('locker_folders')
      .select('id, parent_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    const files = (fileRows ?? []) as Row[];
    const folders = (folderRows ?? []) as Dir[];

    // Mais antigos primeiro, até o primeiro que não cabe: dali em diante tudo sai
    const keep: Row[] = [];
    let used = 0;
    for (const file of files) {
      const size = file.storage === 'link' ? 0 : Number(file.size_bytes) || 0;
      const fitsCount = l.max_files === null || keep.length < l.max_files;
      const fitsSpace = l.limit_bytes === null || used + size <= l.limit_bytes;
      if (!fitsCount || !fitsSpace) break;
      keep.push(file);
      used += size;
    }
    const keepIds = new Set(keep.map(f => f.id));
    const drop = files.filter(f => !keepIds.has(f.id));

    // Os arquivos de verdade primeiro; a linha só sai se o arquivo saiu
    const gone: string[] = [];
    const bucketKeys: string[] = [];
    for (const file of drop) {
      if (file.storage === 'r2' && file.object_key) {
        if (!r2) continue;
        const res = await r2.fetch(file.object_key, { method: 'DELETE' });
        if (res.ok || res.status === 404) gone.push(file.id);
      } else {
        if (file.storage === 'supabase' && file.object_key) bucketKeys.push(file.object_key);
        gone.push(file.id);
      }
    }
    for (let i = 0; i < bucketKeys.length; i += 100) await admin.storage.from('media').remove(bucketKeys.slice(i, i + 100));
    for (let i = 0; i < gone.length; i += 200) await admin.from('locker_files').delete().in('id', gone.slice(i, i + 200));
    removed += gone.length;
    if (gone.length < drop.length) continue; // R2 fora do ar: tenta amanhã

    // Pastas: no plano com limite (free: 1), fica a mais antiga, na raiz, com o que sobrou
    if (l.max_folders !== null && folders.length > l.max_folders) {
      const kept = folders.slice(0, l.max_folders);
      const home = kept[0]?.id ?? null;
      if (home) await admin.from('locker_folders').update({ parent_id: null }).eq('id', home);
      const keptSet = new Set(kept.map(d => d.id));
      const moving = keep.filter(f => !f.folder_id || !keptSet.has(f.folder_id)).map(f => f.id);
      if (moving.length) await admin.from('locker_files').update({ folder_id: home }).in('id', moving);
      const extra = folders.filter(d => !keptSet.has(d.id)).map(d => d.id);
      // Subpastas da pasta que fica também saem (o free tem 1 pasta só): os arquivos já foram movidos
      for (let i = 0; i < extra.length; i += 200) await admin.from('locker_folders').delete().in('id', extra.slice(i, i + 200));
    }
    // Pronto: a conta cabe no plano e o prazo some
    await admin.from('locker_plans').update({ over_limit_since: null }).eq('user_id', userId);
    trimmed++;
  }
  return { users: trimmed, files: removed };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
