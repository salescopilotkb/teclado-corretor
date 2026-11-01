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
 *   { action: "add", name, email, password, teamId? } → { member }
 *   { action: "remove", memberId }                    → { removed: true }
 *   { action: "password", memberId, password }        → { ok: true }
 *
 * Erros: 403 not_company (dependente ou plano sem dependentes) · 403 plan_limit { max }
 * · 409 email_in_use · 400 bad_request / weak_password · 404 not_found
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

  // Só a conta que assina, com um plano que tem dependentes, mexe na equipe
  const { data: plan } = await user.rpc('my_plan');
  const info = plan as { role?: string; status?: string; dependents?: number; limits?: { max_dependents?: number | null } } | null;
  // null = sem limite (Enterprise); sem o campo = plano sem dependentes
  const max = info?.limits && 'max_dependents' in info.limits ? (info.limits.max_dependents ?? null) : 0;
  const active = info?.status === 'active' || info?.status === 'trial';
  if (!info || info.role !== 'owner') return json({ error: 'not_company' }, 403);

  const action = String(body.action ?? '');

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
    const { error } = await admin.auth.admin.updateUserById(memberId, { password });
    return error ? json({ error: 'update_failed' }, 500) : json({ ok: true });
  }

  return json({ error: 'unknown_action' }, 400);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
