/**
 * Supabase Edge Function: aceitar o convite para a equipe de uma empresa (página
 * locker.keyconapp.com/convite/<token>, sem login). A pessoa cria a PRÓPRIA senha;
 * a conta nasce presa à empresa (company_members), como as criadas pela empresa.
 *
 * O convite (supabase/plans.sql, seção 9) vale 7 dias, uma vez só e só para o
 * e-mail convidado. Na hora de aceitar, confere de novo se a empresa ainda tem um
 * plano com equipe e se cabe mais uma pessoa.
 *
 * Publicar (uma vez):
 *   supabase functions deploy team-invite
 *
 * POST { action: "info", token }                      → { company, name, email, expires_at }
 * POST { action: "accept", token, password, adult }   → { accepted: true, email }
 * Erros: 404 invalid_invite (não existe, já usado, cancelado ou vencido) · 403 company_inactive
 * · 403 plan_limit · 409 email_in_use · 400 weak_password / bad_request / not_adult
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MIN_PASSWORD = 8;
const TOKEN = /^[a-f0-9]{64}$/;

type Invite = {
  id: string;
  company_id: string;
  name: string;
  email: string;
  team_id: string | null;
  expires_at: string;
  accepted_at: string | null;
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const token = String(body.token ?? '');
  if (!TOKEN.test(token)) return json({ error: 'invalid_invite' }, 404);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data } = await admin
    .from('company_invites')
    .select('id, company_id, name, email, team_id, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();
  const invite = data as Invite | null;
  if (!invite || invite.accepted_at || Date.parse(invite.expires_at) < Date.now()) return json({ error: 'invalid_invite' }, 404);

  const { data: profile } = await admin
    .from('profiles')
    .select('name, agency, segment, language, market')
    .eq('id', invite.company_id)
    .maybeSingle();
  const company = profile?.agency || profile?.name || '';

  if (body.action === 'info') {
    return json({ company, name: invite.name, email: invite.email, expires_at: invite.expires_at });
  }

  if (body.action !== 'accept') return json({ error: 'bad_request' }, 400);
  if (body.adult !== true) return json({ error: 'not_adult' }, 400);
  const password = String(body.password ?? '');
  if (password.length < MIN_PASSWORD) return json({ error: 'weak_password', min: MIN_PASSWORD }, 400);

  // A empresa ainda tem um plano com equipe, e cabe mais uma pessoa?
  const { data: active } = await admin.rpc('company_active', { company: invite.company_id });
  if (!active) return json({ error: 'company_inactive' }, 403);

  // Uso único: marca antes de criar (dois cliques ao mesmo tempo não criam duas contas)
  const { data: claimed } = await admin
    .from('company_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .select('id');
  if (!claimed?.length) return json({ error: 'invalid_invite' }, 404);
  const release = () => admin.from('company_invites').update({ accepted_at: null }).eq('id', invite.id);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: {
      name: invite.name,
      agency: company,
      segment: profile?.segment ?? 'general',
      language: profile?.language ?? 'pt',
      market: profile?.market ?? 'BR',
      company_id: invite.company_id,
    },
  });
  if (error || !created.user) {
    await release();
    const taken = /already|registered|exists/i.test(error?.message ?? '');
    return json({ error: taken ? 'email_in_use' : 'create_failed' }, taken ? 409 : 500);
  }

  const { error: insertError } = await admin
    .from('company_members')
    .insert({ member_id: created.user.id, company_id: invite.company_id, name: invite.name, email: invite.email, team_id: invite.team_id });
  if (insertError) {
    // Não entrou na empresa: o login não fica solto como conta comum
    await admin.auth.admin.deleteUser(created.user.id);
    await release();
    return insertError.message.includes('plan_limit') ? json({ error: 'plan_limit' }, 403) : json({ error: 'create_failed' }, 500);
  }
  await admin.from('company_invites').update({ accepted_by: created.user.id }).eq('id', invite.id);
  return json({ accepted: true, email: invite.email });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
