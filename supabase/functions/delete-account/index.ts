/**
 * Supabase Edge Function: "Excluir minha conta" (app → Conta). Apaga de verdade:
 *  - os arquivos do Locker na nuvem (Cloudflare R2 e o bucket antigo "media");
 *  - a cópia na nuvem dos produtos, atalhos, agenda e clientes (R2, função backup);
 *  - o cliente no RevenueCat (dados da assinatura; a cobrança em si é da loja: quem
 *    assina cancela na App Store ou na Google Play — o app avisa antes);
 *  - os logins dos dependentes, se for uma conta empresa;
 *  - o login da pessoa: o banco apaga junto, em cascata, o perfil, o plano, as pastas,
 *    os arquivos, os compartilhamentos, as equipes e os dados do app (auth.users).
 *
 * Publicar (uma vez):
 *   supabase functions deploy delete-account
 *
 * POST { confirm: "DELETE" } com o login da pessoa → { deleted: true }
 * Erros: 401 unauthorized · 400 bad_request · 502 storage_failed (nada foi apagado do
 * login: dá para tentar de novo) · 500 delete_failed
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: auth } = await user.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  // Confirmação explícita (o app só manda depois de a pessoa confirmar duas vezes)
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (body.confirm !== 'DELETE') return json({ error: 'bad_request' }, 400);

  // Conta empresa: os dependentes saem junto (o login deles é preso à empresa)
  const { data: members } = await admin.from('company_members').select('member_id').eq('company_id', userId);
  const dependents = ((members ?? []) as Array<{ member_id: string }>).map(m => m.member_id);

  // 1. Os arquivos de verdade. Se algum não sair, para aqui (o login continua: tenta de novo)
  const failed = await deleteStoredFiles(admin, userId);
  if (failed > 0) return json({ error: 'storage_failed', failed }, 502);

  // 2. O cliente no RevenueCat (o histórico da assinatura sai de lá também)
  await deleteRevenueCatCustomer(userId);

  // 3. Os logins (o banco apaga o resto em cascata)
  const r2 = r2FromEnv();
  for (const id of dependents) {
    await deleteRevenueCatCustomer(id);
    // A cópia na nuvem do app do dependente (produtos, atalhos, agenda, clientes)
    await r2?.fetch(`backup/${id}/data.json`, { method: 'DELETE' }).catch(() => {});
    await admin.auth.admin.deleteUser(id);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return json({ error: 'delete_failed' }, 500);
  return json({ deleted: true });
});

/** Apaga os arquivos do Locker no R2 e no bucket "media". Devolve quantos falharam. */
async function deleteStoredFiles(admin: SupabaseClient, userId: string): Promise<number> {
  const r2 = r2FromEnv();
  const bucketKeys: string[] = [];
  let failed = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('locker_files')
      .select('storage, object_key')
      .eq('user_id', userId)
      .range(from, from + 999);
    if (error) return 1;
    const rows = (data ?? []) as Array<{ storage: string; object_key: string | null }>;
    for (const f of rows) {
      if (!f.object_key) continue;
      if (f.storage === 'r2') {
        if (!r2) {
          failed++;
          continue;
        }
        const res = await r2.fetch(f.object_key, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) failed++;
      } else if (f.storage === 'supabase') {
        bucketKeys.push(f.object_key);
      }
    }
    if (rows.length < 1000) break;
  }
  // Cópia na nuvem dos produtos, atalhos, agenda e clientes (função backup)
  if (r2) {
    const res = await r2.fetch(`backup/${userId}/data.json`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) failed++;
  }
  // Fotos e áudios antigos do app: media/<id da pessoa>/...
  const { data: legacy } = await admin.storage.from('media').list(userId, { limit: 1000 });
  for (const item of legacy ?? []) bucketKeys.push(`${userId}/${item.name}`);
  for (let i = 0; i < bucketKeys.length; i += 100) await admin.storage.from('media').remove(bucketKeys.slice(i, i + 100));
  return failed;
}

/** RevenueCat: apaga o cliente (sem a chave configurada, não há o que apagar). */
async function deleteRevenueCatCustomer(userId: string) {
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return;
  try {
    await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch {
    // Sem resposta do RevenueCat: a conta sai mesmo assim (o cliente lá fica sem login)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
