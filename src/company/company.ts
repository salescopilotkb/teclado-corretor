/**
 * Conta empresa (Plus e Pro): as pessoas da equipe (dependentes) e as equipes.
 *
 * Os dependentes ficam em company_members (supabase/plans.sql, seção 7). Criar,
 * remover e trocar a senha passam pela função "company" (precisa da chave
 * service_role); mudar o nome ou a equipe é direto na tabela. As equipes são as
 * do Locker (locker_teams): o banco mantém as pessoas de cada equipe sozinho.
 */
import { t } from '../i18n';
import { supabase } from '../services/supabase';

export interface CompanyMember {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  createdAt: string;
}

export interface CompanyTeam {
  id: string;
  name: string;
}

export class CompanyError extends Error {}

/** As pessoas da equipe, em ordem alfabética. */
export async function listMembers(): Promise<CompanyMember[]> {
  const { data: auth } = await supabase.auth.getSession();
  const companyId = auth.session?.user.id;
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('company_members')
    .select('member_id, name, email, team_id, created_at')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw new CompanyError(t('Não foi possível carregar a equipe. Verifique a internet e tente de novo.'));
  return (data ?? []).map(r => ({ id: r.member_id, name: r.name, email: r.email, teamId: r.team_id, createdAt: r.created_at }));
}

export async function listTeams(): Promise<CompanyTeam[]> {
  const { data: auth } = await supabase.auth.getSession();
  const owner = auth.session?.user.id;
  if (!owner) return [];
  const { data, error } = await supabase.from('locker_teams').select('id, name').eq('owner_id', owner).order('created_at');
  if (error) throw new CompanyError(t('Não foi possível carregar a equipe. Verifique a internet e tente de novo.'));
  return (data ?? []) as CompanyTeam[];
}

const planLimit = (message?: string) => /plan_limit:teams/.test(message ?? '');

export async function createTeam(name: string): Promise<void> {
  const { error } = await supabase.from('locker_teams').insert({ name: name.trim() });
  if (error) {
    throw new CompanyError(
      planLimit(error.message)
        ? t('Seu plano chegou ao limite de equipes. Mude de plano para criar mais.')
        : t('Não foi possível criar a equipe. Tente de novo.'),
    );
  }
}

export async function renameTeam(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('locker_teams').update({ name: name.trim() }).eq('id', id);
  if (error) throw new CompanyError(t('Não foi possível salvar. Tente de novo.'));
}

/** Excluir a equipe: as pessoas continuam na empresa, só ficam sem equipe. */
export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('locker_teams').delete().eq('id', id);
  if (error) throw new CompanyError(t('Não foi possível excluir. Tente de novo.'));
}

export async function setMemberTeam(memberId: string, teamId: string | null): Promise<void> {
  const { error } = await supabase.from('company_members').update({ team_id: teamId }).eq('member_id', memberId);
  if (error) throw new CompanyError(t('Não foi possível salvar. Tente de novo.'));
}

/** Chama a função "company" e traduz o erro. */
async function callCompany(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('company', { body });
  if (!error) return (data ?? {}) as Record<string, unknown>;
  let code = '';
  let max: number | undefined;
  let min: number | undefined;
  try {
    const reply = await (error as { context?: Response }).context?.json();
    code = String(reply?.error ?? '');
    max = reply?.max;
    min = reply?.min;
  } catch {
    // sem resposta: sem internet ou função não publicada
  }
  switch (code) {
    case 'email_in_use':
      throw new CompanyError(t('Este e-mail já tem uma conta KEYCON. Use outro e-mail para esta pessoa.'));
    case 'weak_password':
      throw new CompanyError(t('A senha precisa ter pelo menos {n} caracteres.', { n: min ?? 6 }));
    case 'plan_limit':
      throw new CompanyError(t('Seu plano permite até {n} pessoas. Mude de plano para adicionar mais.', { n: max ?? 0 }));
    case 'not_company':
      throw new CompanyError(t('Só o Plus e o Pro têm pessoas na equipe. Assine um deles para adicionar.'));
    case 'already_invited':
      throw new CompanyError(t('Já existe um convite em aberto para este e-mail. Copie o link na lista de convites.'));
    case 'bad_request':
      throw new CompanyError(t('Confira o nome e o e-mail.'));
    default:
      throw new CompanyError(t('Não foi possível concluir. Verifique a internet e tente de novo.'));
  }
}

export async function addMember(input: { name: string; email: string; password: string; teamId: string | null }): Promise<void> {
  await callCompany({ action: 'add', name: input.name, email: input.email, password: input.password, teamId: input.teamId });
}

/** Remove a pessoa: o login dela deixa de existir (o que estava só no celular dela fica lá). */
export async function removeMember(memberId: string): Promise<void> {
  await callCompany({ action: 'remove', memberId });
}

export async function setMemberPassword(memberId: string, password: string): Promise<void> {
  await callCompany({ action: 'password', memberId, password });
}

// ── Convites (link de uso único) e sair da equipe ───────────────────────

export interface CompanyInvite {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  link: string;
  expiresAt: string;
}

const LOCKER_INVITE_URL = 'https://locker.keyconapp.com/convite/';

/** Convites em aberto (ainda não aceitos e dentro dos 7 dias). */
export async function listInvites(): Promise<CompanyInvite[]> {
  const { data: auth } = await supabase.auth.getSession();
  const companyId = auth.session?.user.id;
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('company_invites')
    .select('id, name, email, team_id, token, expires_at')
    .eq('company_id', companyId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  // Banco sem a tabela (plans.sql, seção 9, ainda não rodou): sem convites
  if (error) return [];
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    teamId: r.team_id,
    link: LOCKER_INVITE_URL + r.token,
    expiresAt: r.expires_at,
  }));
}

/** Convida pelo nome e e-mail: devolve o link para mandar à pessoa (vale 7 dias, uma vez). */
export async function inviteMember(input: { name: string; email: string; teamId: string | null }): Promise<CompanyInvite> {
  const reply = await callCompany({ action: 'invite', name: input.name, email: input.email, teamId: input.teamId });
  const invite = reply.invite as { id: string; token: string; link: string; expires_at: string };
  return {
    id: invite.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    teamId: input.teamId,
    link: invite.link || LOCKER_INVITE_URL + invite.token,
    expiresAt: invite.expires_at,
  };
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await callCompany({ action: 'cancel_invite', inviteId });
}

/**
 * O funcionário sai da equipe: perde o acesso ao Locker da empresa e a conta
 * continua, como uma conta comum no plano grátis (pode assinar um plano depois).
 */
export async function leaveCompany(): Promise<void> {
  await callCompany({ action: 'leave' });
}
