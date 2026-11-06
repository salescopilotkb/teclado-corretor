/**
 * Supabase Edge Function: a cópia na nuvem dos dados do app (Cloudflare R2).
 *
 * Produtos, atalhos, agenda e clientes do CRM ficam no aparelho (MMKV) e uma cópia
 * em JSON fica no R2, em backup/<id do usuário>/data.json. Quem reinstala o app ou
 * entra em outro aparelho recebe tudo de volta (src/sync/cloudBackup.ts). A junção
 * dos dados (item por item, o mais novo vence) é feita no app; aqui só se guarda e
 * se entrega a cópia, sempre da própria pessoa.
 *
 * Publicar (uma vez; usa as mesmas chaves do R2 do Locker):
 *   supabase functions deploy backup
 *
 * Só aceita usuários logados (verify_jwt). Sem as chaves do R2 responde 503
 * { error: "r2_not_configured" }: o app continua só com a cópia do aparelho.
 *
 * Ações (POST, JSON):
 *   { action: "get" }                → { data: <cópia> | null, etag: string | null }
 *   { action: "put", data, etag }    → { etag }
 *       etag = o que veio no "get" (null = ainda não havia cópia). Se outro aparelho
 *       gravou no meio-tempo: 409 { error: "conflict" } (o app baixa de novo, junta e
 *       tenta outra vez).
 * Erros: 401 unauthorized · 400 bad_request · 413 too_large · 502 r2_failed
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Texto e links: mesmo uma conta grande fica bem abaixo disso. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Mesmo caminho que a função delete-account apaga. */
const backupKey = (userId: string) => `backup/${userId}/data.json`;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const r2 = r2FromEnv();
  if (!r2) return json({ error: 'r2_not_configured' }, 503);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const key = backupKey(userId);
  const action = String(body.action ?? '');

  if (action === 'get') {
    const res = await r2.fetch(key, { method: 'GET' });
    if (res.status === 404) return json({ data: null, etag: null });
    if (!res.ok) return json({ error: 'r2_failed' }, 502);
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Cópia estragada: o app trata como se não houvesse e grava uma nova por cima
      data = null;
    }
    return json({ data, etag: res.headers.get('ETag') });
  }

  if (action === 'put') {
    const data = body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'bad_request' }, 400);
    const text = JSON.stringify(data);
    if (new TextEncoder().encode(text).length > MAX_BYTES) return json({ error: 'too_large', max: MAX_BYTES }, 413);
    const etag = typeof body.etag === 'string' && body.etag ? body.etag : null;
    // Só grava se a cópia ainda for a que o app leu (nenhum outro aparelho gravou no meio)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (etag) headers['If-Match'] = etag;
    else headers['If-None-Match'] = '*';
    const res = await r2.fetch(key, { method: 'PUT', headers, body: text });
    if (res.status === 412 || res.status === 409) return json({ error: 'conflict' }, 409);
    if (!res.ok) return json({ error: 'r2_failed' }, 502);
    return json({ etag: res.headers.get('ETag') });
  }

  return json({ error: 'unknown_action' }, 400);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
