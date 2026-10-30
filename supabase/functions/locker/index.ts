/**
 * Supabase Edge Function: os arquivos do Locker no Cloudflare R2.
 *
 * O app e o teclado nunca têm as chaves do R2: pedem aqui links temporários
 * (assinados) para enviar e baixar direto do R2, sem o arquivo passar pelo
 * Supabase. Antes de cada envio, confere o espaço livre do plano (5/20/100 GB,
 * ver locker_usage em supabase/locker.sql).
 *
 * Publicar (uma vez):
 *   supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=keycon-locker
 *   supabase functions deploy locker
 *
 * Só aceita usuários logados (o Supabase confere o JWT do app: verify_jwt).
 * Sem as chaves do R2 responde 503 { error: "r2_not_configured" }: o app então
 * continua usando o bucket "media" do Supabase, como antes.
 *
 * Ações (POST, JSON):
 *   { action: "upload", name, mime, size }  → { key, uploadUrl, expiresIn }  (PUT do arquivo com Content-Type = mime)
 *   { action: "sign", keys: [...] }          → { urls: { key: url }, expiresIn }  (links de download, 7 dias)
 *   { action: "delete", keys: [...] }        → { deleted }
 *   { action: "usage" }                      → { used, limit, plan }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Mesmo limite do app (MAX_UPLOAD_BYTES em src/services/mediaUpload.ts). */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Envio: o link vale 15 minutos. Download: 7 dias (o app guarda e renova antes de vencer). */
const UPLOAD_EXPIRES = 15 * 60;
const DOWNLOAD_EXPIRES = 7 * 24 * 60 * 60;
const MAX_BATCH = 100;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const r2 = r2FromEnv();
  if (!r2) return json({ error: 'r2_not_configured' }, 503);

  // Cliente com o login da própria pessoa: as regras (RLS) valem também aqui
  const authorization = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
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

  const presign = r2.presign;
  /** Só mexe nos arquivos da própria pessoa: o caminho começa com o id dela. */
  const ownKeys = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .filter((k): k is string => typeof k === 'string' && k.startsWith(`${userId}/`) && !k.includes('..'))
      .slice(0, MAX_BATCH);

  const action = String(body.action ?? '');

  if (action === 'usage') {
    const usage = await usageOf(supabase);
    return usage ? json(usage) : json({ error: 'locker_not_installed' }, 409);
  }

  if (action === 'upload') {
    const size = Number(body.size ?? 0);
    const mime = String(body.mime ?? 'application/octet-stream').slice(0, 100);
    const name = String(body.name ?? 'arquivo');
    if (!Number.isFinite(size) || size < 0) return json({ error: 'bad_size' }, 400);
    if (size > MAX_FILE_BYTES) return json({ error: 'file_too_large', max: MAX_FILE_BYTES }, 413);
    const usage = await usageOf(supabase);
    if (usage && usage.used + size > usage.limit) return json({ error: 'quota_exceeded', ...usage }, 413);
    const key = `${userId}/${randomName()}.${extensionFor(mime, name)}`;
    const uploadUrl = await presign('PUT', key, UPLOAD_EXPIRES, { 'Content-Type': mime });
    return json({ key, uploadUrl, expiresIn: UPLOAD_EXPIRES });
  }

  if (action === 'sign') {
    const keys = ownKeys(body.keys);
    const urls: Record<string, string> = {};
    for (const key of keys) urls[key] = await presign('GET', key, DOWNLOAD_EXPIRES);
    return json({ urls, expiresIn: DOWNLOAD_EXPIRES });
  }

  if (action === 'delete') {
    const keys = ownKeys(body.keys);
    let deleted = 0;
    for (const key of keys) {
      const res = await r2.fetch(key, { method: 'DELETE' });
      if (res.ok || res.status === 404) deleted++;
    }
    return json({ deleted });
  }

  return json({ error: 'unknown_action' }, 400);
});

async function usageOf(
  supabase: ReturnType<typeof createClient>,
): Promise<{ used: number; limit: number; plan: string } | null> {
  const { data, error } = await supabase.rpc('locker_usage');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    used: Number(row?.used_bytes ?? 0),
    limit: Number(row?.limit_bytes ?? 5368709120),
    plan: String(row?.plan ?? 'basic'),
  };
}

/** Nome aleatório: ninguém adivinha o caminho de outro arquivo. */
function randomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${Date.now().toString(36)}-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

function extensionFor(mime: string, name: string): string {
  const fromType = EXTENSION_BY_TYPE[mime.toLowerCase()];
  if (fromType) return fromType;
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1];
  return (fromName ?? 'bin').toLowerCase();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
