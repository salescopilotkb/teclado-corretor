/**
 * Supabase Edge Function: os dependentes da conta empresa (Plus: até 5; Pro: até 50).
 *
 * A empresa (a conta que assina) cria o acesso de cada pessoa da equipe: um login
 * próprio (e-mail e senha), preso à empresa. Só a empresa remove. Criar e remover
 * logins precisa da chave service_role, por isso passa por aqui (supabase/plans.sql,
 * seção 7: company_members).
 *
 * Publicar (uma vez):
 *   supabase functions deploy company
 *
 * Ações (POST, JSON, com o login da empresa):
 *   { action: "invite", name, email, teamId? }        → { invite: { id, token, link, expires_at } }
 *   { action: "cancel_invite", inviteId }             → { cancelled: true }
 *   { action: "add", name, email, password, teamId? } → { member }  (a pessoa troca a senha no 1º login)
 *   { action: "remove", memberId }                    → { removed: true }  (apaga o login)
 *   { action: "password", memberId, password }        → { ok: true }  (troca de novo no próximo login)
 * Ação do funcionário (com o login dele):
 *   { action: "leave" } → { left: true }: sai da equipe; a conta continua, no plano grátis
 *
 * Erros: 403 not_company (dependente ou plano sem dependentes) · 403 plan_limit { max }
 * · 409 email_in_use / already_invited · 400 bad_request / weak_password · 404 not_found
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

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
  const companyId = auth.user?.id;
  if (!companyId) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // O funcionário sai da equipe: a ligação com a empresa acaba e a conta vira comum
  if (String(body.action ?? '') === 'leave') {
    const { data: row } = await admin.from('company_members').select('member_id').eq('member_id', companyId).maybeSingle();
    if (!row) return json({ error: 'not_found' }, 404);
    const { error } = await admin.from('company_members').delete().eq('member_id', companyId);
    if (error) return json({ error: 'leave_failed' }, 500);
    await admin.auth.admin.updateUserById(companyId, { user_metadata: { company_id: null, must_change_password: false } });
    return json({ left: true });
  }

  // Só a conta que assina, com um plano que tem dependentes, mexe na equipe
  const { data: plan } = await user.rpc('my_plan');
  const info = plan as { role?: string; status?: string; dependents?: number; limits?: { max_dependents?: number | null } } | null;
  // null = sem limite (Enterprise); sem o campo = plano sem dependentes
  const max = info?.limits && 'max_dependents' in info.limits ? (info.limits.max_dependents ?? null) : 0;
  const active = info?.status === 'active' || info?.status === 'trial';
  if (!info || info.role !== 'owner') return json({ error: 'not_company' }, 403);

  const action = String(body.action ?? '');

  if (action === 'invite') {
    if (!active || max === 0) return json({ error: 'not_company' }, 403);
    const name = String(body.name ?? '')
      .trim()
      .slice(0, 120);
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const teamId = body.teamId ? String(body.teamId) : null;
    if (!name || !EMAIL.test(email)) return json({ error: 'bad_request' }, 400);
    // Convites em aberto contam no limite do plano (junto com quem já está na equipe)
    const now = new Date().toISOString();
    const { data: open } = await admin
      .from('company_invites')
      .select('id, email')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .gt('expires_at', now);
    const pending = (open ?? []) as Array<{ id: string; email: string }>;
    if (pending.some(i => i.email === email)) return json({ error: 'already_invited' }, 409);
    if (max !== null && (info.dependents ?? 0) + pending.length >= max) return json({ error: 'plan_limit', max }, 403);
    const { data: member } = await admin.from('company_members').select('member_id').eq('email', email).maybeSingle();
    if (member) return json({ error: 'email_in_use' }, 409);
    if (teamId) {
      const { data: team } = await admin.from('locker_teams').select('id').eq('id', teamId).eq('owner_id', companyId).maybeSingle();
      if (!team) return json({ error: 'bad_request' }, 400);
    }
    const { data: invite, error } = await admin
      .from('company_invites')
      .insert({ company_id: companyId, name, email, team_id: teamId })
      .select('id, token, expires_at')
      .single();
    if (error || !invite) return json({ error: 'create_failed' }, 500);
    const locker = Deno.env.get('LOCKER_URL') ?? 'https://locker.keyconapp.com';
    return json({ invite: { ...invite, link: `${locker}/convite/${invite.token}` } });
  }

  if (action === 'cancel_invite') {
    const inviteId = String(body.inviteId ?? '');
    const { data: gone } = await admin
      .from('company_invites')
      .delete()
      .eq('id', inviteId)
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .select('id');
    return gone?.length ? json({ cancelled: true }) : json({ error: 'not_found' }, 404);
  }

  if (action === 'add') {
    if (!active || max === 0) return json({ error: 'not_company' }, 403);
    if (max !== null && (info.dependents ?? 0) >= max) return json({ error: 'plan_limit', max }, 403);
    const name = String(body.name ?? '')
      .trim()
      .slice(0, 120);
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '');
    const teamId = body.teamId ? String(body.teamId) : null;
    if (!name || !EMAIL.test(email)) return json({ error: 'bad_request' }, 400);
    if (password.length < MIN_PASSWORD) return json({ error: 'weak_password', min: MIN_PASSWORD }, 400);

    // O dependente começa com o ramo, o idioma e o mercado da empresa
    const { data: profile } = await admin
      .from('profiles')
      .select('name, agency, segment, language, market')
      .eq('id', companyId)
      .maybeSingle();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        agency: profile?.agency || profile?.name || '',
        segment: profile?.segment ?? 'general',
        language: profile?.language ?? 'pt',
        market: profile?.market ?? 'BR',
        company_id: companyId,
        // A empresa escolheu a senha: no primeiro login a pessoa cria a dela
        must_change_password: true,
      },
    });
    if (error || !created.user) {
      const taken = /already|registered|exists/i.test(error?.message ?? '');
      return json({ error: taken ? 'email_in_use' : 'create_failed' }, taken ? 409 : 500);
    }
    const { data: member, error: insertError } = await admin
      .from('company_members')
      .insert({ member_id: created.user.id, company_id: companyId, name, email, team_id: teamId })
      .select('member_id, name, email, team_id, created_at')
      .single();
    if (insertError) {
      // Não entrou na empresa: o login não pode ficar solto como conta comum
      await admin.auth.admin.deleteUser(created.user.id);
      return insertError.message.includes('plan_limit:dependents')
        ? json({ error: 'plan_limit', max }, 403)
        : json({ error: 'create_failed' }, 500);
    }
    return json({ member });
  }

  if (action === 'remove' || action === 'password') {
    const memberId = String(body.memberId ?? '');
    const { data: row } = await admin
      .from('company_members')
      .select('member_id')
      .eq('member_id', memberId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!row) return json({ error: 'not_found' }, 404);

    if (action === 'remove') {
      // Apagar o login apaga a ligação com a empresa (cascade) e tira das equipes
      const { error } = await admin.auth.admin.deleteUser(memberId);
      return error ? json({ error: 'remove_failed' }, 500) : json({ removed: true });
    }

    const password = String(body.password ?? '');
    if (password.length < MIN_PASSWORD) return json({ error: 'weak_password', min: MIN_PASSWORD }, 400);
    // Senha escolhida pela empresa: a pessoa troca de novo no próximo login
    const { error } = await admin.auth.admin.updateUserById(memberId, { password, user_metadata: { must_change_password: true } });
    return error ? json({ error: 'update_failed' }, 500) : json({ ok: true });
  }

  return json({ error: 'unknown_action' }, 400);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
