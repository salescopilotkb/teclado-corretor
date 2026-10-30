/**
 * Supabase Edge Function: os links públicos do Locker (abrem SEM login).
 *
 *   GET ?f=<código do arquivo>             → abre o arquivo (redireciona para um link do R2 de 1 hora)
 *   GET ?f=<código>&download=1             → baixa com o nome do arquivo
 *   GET ?d=<código da pasta>[&sub=<id>]    → JSON com a pasta, as subpastas e os arquivos
 *
 * Quem tem o link de um ARQUIVO abre o arquivo (também se ele estiver numa pasta
 * privada: foi o próprio arquivo que a pessoa compartilhou). Uma PASTA só abre se
 * estiver como "link" ou "public"; as subpastas dela abrem junto (sub = id da
 * subpasta, conferida para ser mesmo de dentro). Nada da lixeira aparece.
 *
 * Publicar (uma vez), SEM exigir login:
 *   supabase functions deploy locker-public --no-verify-jwt
 *
 * Lê o banco com a chave service_role (só no servidor): as regras de cada conta
 * (RLS) não deixariam um visitante sem login ver nada. Por isso todo pedido é
 * conferido aqui pelo código do link, que é aleatório e não dá para adivinhar.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { r2FromEnv } from '../_shared/r2.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Link de visualização/download que o visitante recebe: 1 hora. */
const VIEW_EXPIRES = 60 * 60;
const TOKEN = /^[a-f0-9]{32}$/;
const MAX_ITEMS = 500;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const params = new URL(req.url).searchParams;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const r2 = r2FromEnv();

  /** Endereço para abrir o arquivo agora (R2: link assinado curto; outros: o link guardado). */
  const viewUrl = async (row: { storage: string; object_key: string; url: string; name: string }, download = false) => {
    if (row.storage !== 'r2') return row.url || null;
    if (!r2) return null;
    if (!download) return r2.presign('GET', row.object_key, VIEW_EXPIRES);
    // Baixar com o nome do arquivo: o parâmetro entra na assinatura do link
    // filename* (UTF-8) mantém acentos ("Catálogo"); filename é a reserva sem acentos
    const filename = row.name.replace(/["\\\r\n]/g, '') || 'arquivo';
    const ascii = filename.normalize('NFD').replace(/[^\x20-\x7e]/g, '') || 'arquivo';
    return r2.presign('GET', row.object_key, VIEW_EXPIRES, undefined, {
      'response-content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  };

  // ── Um arquivo ──
  const fileToken = params.get('f');
  if (fileToken) {
    if (!TOKEN.test(fileToken)) return notFound();
    const { data: file } = await db
      .from('locker_files')
      .select('name, storage, object_key, url, trashed_at')
      .eq('share_token', fileToken)
      .maybeSingle();
    if (!file || file.trashed_at) return notFound();
    const target = await viewUrl(file, params.get('download') === '1');
    if (!target) return json({ error: 'unavailable' }, 503);
    return new Response(null, { status: 302, headers: { ...CORS, Location: target, 'Cache-Control': 'no-store' } });
  }

  // ── Uma pasta compartilhada ──
  const folderToken = params.get('d');
  if (folderToken) {
    if (!TOKEN.test(folderToken)) return notFound();
    const { data: root } = await db
      .from('locker_folders')
      .select('id, user_id, name, visibility, trashed_at')
      .eq('share_token', folderToken)
      .maybeSingle();
    if (!root || root.trashed_at || root.visibility === 'private') return notFound();

    // Todas as pastas da conta (para conferir que a subpasta pedida é de dentro da compartilhada)
    const { data: all } = await db
      .from('locker_folders')
      .select('id, parent_id, name, trashed_at')
      .eq('user_id', root.user_id)
      .is('trashed_at', null)
      .limit(5000);
    const byId = new Map((all ?? []).map(f => [f.id, f]));
    const sub = params.get('sub');
    let current = root.id as string;
    const trail: Array<{ id: string; name: string }> = [];
    if (sub && sub !== root.id) {
      // Sobe da subpasta até a compartilhada; se não chegar nela, não é de dentro
      let at = byId.get(sub);
      const chain: Array<{ id: string; name: string }> = [];
      while (at && at.id !== root.id) {
        chain.unshift({ id: at.id, name: at.name });
        at = at.parent_id ? byId.get(at.parent_id) : undefined;
      }
      if (!at) return notFound();
      current = sub;
      trail.push(...chain);
    }

    const folders = (all ?? []).filter(f => f.parent_id === current).map(f => ({ id: f.id, name: f.name }));
    const { data: files } = await db
      .from('locker_files')
      .select('name, kind, mime, size_bytes, storage, object_key, url, share_token, created_at')
      .eq('user_id', root.user_id)
      .eq('folder_id', current)
      .is('trashed_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS);

    const list = [];
    for (const f of files ?? []) {
      list.push({
        name: f.name,
        kind: f.kind,
        mime: f.mime,
        size: Number(f.size_bytes) || 0,
        createdAt: f.created_at,
        // Link permanente do arquivo (o mesmo que o dono copia no app)
        link: `f/${f.share_token}`,
        // Para a prévia na página (vale 1 hora)
        url: await viewUrl(f),
      });
    }
    return json(
      {
        folder: { id: current, name: trail.length ? trail[trail.length - 1].name : root.name, root: { name: root.name } },
        // Caminho a partir da pasta compartilhada (sem nada acima dela)
        path: trail,
        folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
        files: list,
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  }

  return notFound();
});

const notFound = () => json({ error: 'not_found' }, 404);

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}
