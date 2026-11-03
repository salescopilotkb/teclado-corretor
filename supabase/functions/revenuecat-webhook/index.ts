/**
 * Supabase Edge Function: avisos do RevenueCat (compra, renovação, troca de plano,
 * cancelamento, fim do teste grátis, vencimento, reembolso, transferência).
 *
 * A cada aviso, confere o assinante na API do RevenueCat e grava o plano da conta
 * (_shared/revenuecat.ts). Por conferir o estado atual, a ordem e a repetição dos
 * avisos não importam.
 *
 * Publicar (uma vez), SEM exigir login (quem chama é o RevenueCat):
 *   supabase secrets set REVENUECAT_SECRET_KEY=sk_... REVENUECAT_WEBHOOK_SECRET=<senha longa>
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 * No RevenueCat → Integrations → Webhooks: a URL desta função e, em Authorization
 * header value, "Bearer <a mesma senha>".
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { isAccountId, syncSubscriber } from '../_shared/revenuecat.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) return json({ error: 'unauthorized' }, 401);

  let event: Record<string, unknown> = {};
  try {
    event = ((await req.json()) as { event?: Record<string, unknown> }).event ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // Todas as contas citadas no aviso (na transferência, a que perdeu e a que ganhou)
  const list = (v: unknown) => (Array.isArray(v) ? v : [v]);
  const ids = [
    ...new Set(
      [event.app_user_id, event.original_app_user_id, ...list(event.transferred_from), ...list(event.transferred_to)].filter(isAccountId),
    ),
  ];

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const results: Record<string, unknown> = {};
  let failed = false;
  for (const id of ids) {
    try {
      results[id] = await syncSubscriber(admin, id);
    } catch (e) {
      failed = true;
      results[id] = { error: e instanceof Error ? e.message : 'failed' };
    }
  }
  // Erro: o RevenueCat tenta de novo mais tarde
  return json({ type: event.type ?? null, results }, failed ? 500 : 200);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
