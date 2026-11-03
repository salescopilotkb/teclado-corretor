/**
 * Supabase Edge Function: assinatura da própria conta, chamada pelo app.
 *
 * Ações (POST, JSON, com o login da pessoa):
 *   { action: "sync" }          → confere já no RevenueCat e grava o plano (depois de
 *                                 comprar ou restaurar, sem esperar o aviso chegar)
 *   { action: "cancel_google" } → troca de Android para iPhone: cancela a RENOVAÇÃO na
 *                                 Google Play (o plano vale até o fim do período pago);
 *                                 depois disso, a pessoa assina pela App Store
 *
 * Publicar (uma vez):
 *   supabase functions deploy billing
 * Usa o segredo REVENUECAT_SECRET_KEY (ver revenuecat-webhook).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { cancelGoogleRenewal, syncSubscriber } from '../_shared/revenuecat.ts';

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
  const { data: auth } = await user.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  try {
    if (body.action === 'sync') return json(await syncSubscriber(admin, userId));

    if (body.action === 'cancel_google') {
      const { data: row } = await admin.from('locker_plans').select('store, product_id, expires_at, will_renew').eq('user_id', userId).maybeSingle();
      if (!row || row.store !== 'play_store' || !row.product_id) return json({ error: 'not_google' }, 409);
      if (row.will_renew) await cancelGoogleRenewal(userId, row.product_id);
      await syncSubscriber(admin, userId);
      return json({ cancelled: true, until: row.expires_at });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed';
    return json({ error: message === 'revenuecat_not_configured' ? message : 'billing_failed' }, message === 'revenuecat_not_configured' ? 503 : 502);
  }

  return json({ error: 'unknown_action' }, 400);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
