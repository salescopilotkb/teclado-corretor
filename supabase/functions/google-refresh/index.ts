/**
 * Supabase Edge Function: renova o acesso do usuário ao Google Agenda/Meet.
 *
 * O token de acesso do Google dura ~1 hora. A renovação exige o Client Secret
 * do cliente OAuth, que NUNCA pode ir dentro do app: ele fica só aqui, nos
 * segredos da função.
 *
 * Publicar (uma vez):
 *   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
 *   supabase functions deploy google-refresh
 *
 * Só aceita usuários logados: o Supabase confere o JWT do app (verify_jwt).
 * Entrada: { "refresh_token": "..." }  Saída: { "access_token": "...", "expires_in": 3599 }
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let refreshToken = '';
  try {
    refreshToken = String((await req.json())?.refresh_token ?? '');
  } catch {
    // corpo inválido: cai no erro abaixo
  }
  if (!refreshToken) return json({ error: 'missing_refresh_token' }, 400);

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'server_not_configured' }, 500);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  // invalid_grant = a pessoa tirou o acesso do KEYCON na conta Google: o app pede para conectar de novo
  if (!res.ok || !data.access_token) return json({ error: data.error ?? 'refresh_failed' }, res.status === 400 ? 401 : 502);
  return json({ access_token: data.access_token, expires_in: data.expires_in ?? 3600 });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
