/**
 * Supabase Edge Function: esvazia a lixeira do Locker depois de 30 dias.
 *
 * Roda uma vez por dia, chamada pelo agendador do banco (supabase/locker-purge.sql).
 * Apaga para sempre o que está na lixeira há mais de 30 dias: as linhas das tabelas
 * e os arquivos de verdade (no R2 e no bucket "media"). O que estava dentro de uma
 * pasta da lixeira vai junto com ela.
 *
 * Publicar (uma vez):
 *   supabase secrets set CRON_SECRET=<uma senha longa qualquer>
 *   supabase functions deploy locker-purge --no-verify-jwt
 *
 * Sem login de usuário: só aceita quem manda o cabeçalho x-cron-secret certo, e usa
 * a chave service_role (já existe nos segredos de toda Edge Function).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

const TRASH_DAYS = 30;
/** Por execução: o que sobrar sai no dia seguinte. */
const MAX_FILES = 2000;

type Folder = { id: string; user_id: string; parent_id: string | null; trashed_at: string | null };
type File = { id: string; user_id: string; folder_id: string | null; storage: string; object_key: string; trashed_at: string | null };

Deno.serve(async req => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiredFolders, error: e1 } = await admin.from('locker_folders').select('id, user_id, parent_id, trashed_at').lt('trashed_at', cutoff);
  const { data: expiredFiles, error: e2 } = await admin
    .from('locker_files')
    .select('id, user_id, folder_id, storage, object_key, trashed_at')
    .lt('trashed_at', cutoff)
    .limit(MAX_FILES);
  if (e1 || e2) return json({ error: 'query_failed' }, 500);

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

  return json({ files: gone.length, folders: topFolders.length });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
