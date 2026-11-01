/**
 * Supabase Edge Function: abre o Locker web (locker.keyconapp.com) já logado.
 *
 * O app pede aqui uma entrada de USO ÚNICO para a própria conta (o "link mágico" do
 * Supabase, sem mandar e-mail) e abre no navegador: locker.keyconapp.com/?entrar=<código>.
 * É a PÁGINA do Locker que troca o código pela sessão (verifyOtp), no navegador da
 * pessoa. Assim, o celular abrir o endereço "por baixo" (prévia do link) não gasta a
 * entrada, o que acontecia com o link do Supabase direto (erro otp_expired). O código
 * não serve de novo e vence sozinho. Nada de senha no endereço.
 *
 * Publicar (uma vez):
 *   supabase secrets set LOCKER_URL=https://locker.keyconapp.com
 *   supabase functions deploy locker-handoff
 * E em Authentication → URL Configuration → Redirect URLs: https://locker.keyconapp.com/**
 *
 * Só aceita usuários logados (verify_jwt). Usa a chave service_role, que existe só
 * no servidor (SUPABASE_SERVICE_ROLE_KEY), para gerar o link.
 *
 * Entrada: { path?: "/pasta/123" }  Saída: { url: "https://locker.keyconapp.com/?entrar=<código>" }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return json({ error: 'server_not_configured' }, 500);
  const lockerUrl = (Deno.env.get('LOCKER_URL') ?? 'https://locker.keyconapp.com').replace(/\/+$/, '');

  // Quem pediu: o login do próprio app
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  const email = userData.user?.email;
  if (!email) return json({ error: 'unauthorized' }, 401);

  let path = '/';
  try {
    const body = await req.json();
    // Só caminhos do próprio Locker (nada de mandar a pessoa para outro site)
    if (typeof body?.path === 'string' && /^\/[\w\-/]*$/.test(body.path)) path = body.path;
  } catch {
    // sem corpo: abre a raiz do Locker
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${lockerUrl}${path}` },
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return json({ error: 'link_failed' }, 502);
  return json({ url: `${lockerUrl}${path}?entrar=${encodeURIComponent(hashed)}` });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
