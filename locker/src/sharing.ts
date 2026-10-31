/**
 * Compartilhar com pessoas e equipes (tabelas locker_shares, locker_teams e
 * locker_team_members em supabase/locker.sql). Acesso de leitor: quem recebe vê,
 * abre e baixa a pasta (com tudo dentro) ou o arquivo, em "Compartilhados comigo".
 */
import { t } from '../../src/i18n';
import { supabase } from './data';
import type { LockerFile, LockerFolder } from './data';
import { demoShared, PREVIEW } from './demo';

export type Share = {
  id: string;
  owner_id: string;
  owner_email: string;
  folder_id: string | null;
  file_id: string | null;
  grantee_email: string | null;
  team_id: string | null;
  role: 'viewer';
  created_at: string;
};

export type Team = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  members: string[];
};

/** O que foi compartilhado com a pessoa (de outras contas). */
export type SharedData = { folders: LockerFolder[]; files: LockerFile[]; shares: Share[] };

export const EMPTY_SHARED: SharedData = { folders: [], files: [], shares: [] };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (text: string) => EMAIL.test(text.trim());

const fail = (error: unknown) => {
  if (error) throw new Error(t('Não foi possível salvar. Confira a internet e tente de novo.'));
};

/** Tabelas de compartilhar ainda não criadas (rodar o locker.sql de novo). */
const missing = (error: { code?: string; message?: string } | null) => !!error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? ''));

export async function fetchShared(userId: string): Promise<SharedData> {
  if (PREVIEW) return demoShared();
  const [shares, folders, files] = await Promise.all([
    supabase.from('locker_shares').select('*').neq('owner_id', userId),
    supabase.from('locker_folders').select('*').neq('user_id', userId),
    supabase.from('locker_files').select('*').neq('user_id', userId),
  ]);
  if (missing(shares.error)) return EMPTY_SHARED;
  if (shares.error || folders.error || files.error) throw shares.error ?? folders.error ?? files.error;
  return { shares: (shares.data ?? []) as Share[], folders: (folders.data ?? []) as LockerFolder[], files: (files.data ?? []) as LockerFile[] };
}

// -----------------------------------------------------------------------------
// Quem tem acesso a uma pasta ou arquivo meu
// -----------------------------------------------------------------------------
export type ShareTarget = { kind: 'folder'; id: string } | { kind: 'file'; id: string };

export async function listShares(target: ShareTarget, userId: string): Promise<Share[]> {
  const { data, error } = await supabase
    .from('locker_shares')
    .select('*')
    .eq('owner_id', userId)
    .eq(target.kind === 'folder' ? 'folder_id' : 'file_id', target.id)
    .order('created_at');
  if (missing(error)) throw new Error(t('O compartilhamento ainda não foi ligado no servidor (rode o supabase/locker.sql de novo).'));
  fail(error);
  return (data ?? []) as Share[];
}

export async function addShare(target: ShareTarget, grantee: { email: string } | { teamId: string }) {
  const row = {
    folder_id: target.kind === 'folder' ? target.id : null,
    file_id: target.kind === 'file' ? target.id : null,
    grantee_email: 'email' in grantee ? grantee.email.trim().toLowerCase() : null,
    team_id: 'teamId' in grantee ? grantee.teamId : null,
  };
  const { error } = await supabase.from('locker_shares').insert(row);
  // Já tinha acesso: tudo certo
  if (error?.code === '23505') return;
  fail(error);
}

export async function removeShare(id: string) {
  fail((await supabase.from('locker_shares').delete().eq('id', id)).error);
}

// -----------------------------------------------------------------------------
// Equipes
// -----------------------------------------------------------------------------
export async function listTeams(): Promise<Team[]> {
  if (PREVIEW) return [];
  const { data, error } = await supabase.from('locker_teams').select('id, owner_id, name, created_at, locker_team_members(email)').order('name');
  if (missing(error)) return [];
  fail(error);
  return ((data ?? []) as Array<Omit<Team, 'members'> & { locker_team_members: Array<{ email: string }> | null }>).map(row => ({
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    created_at: row.created_at,
    members: (row.locker_team_members ?? []).map(m => m.email).sort(),
  }));
}

export async function createTeam(name: string): Promise<string> {
  const { data, error } = await supabase.from('locker_teams').insert({ name }).select('id').single();
  fail(error);
  return (data as { id: string }).id;
}

export const renameTeam = async (id: string, name: string) => fail((await supabase.from('locker_teams').update({ name }).eq('id', id)).error);
export const deleteTeam = async (id: string) => fail((await supabase.from('locker_teams').delete().eq('id', id)).error);

export async function addMember(teamId: string, email: string) {
  const { error } = await supabase.from('locker_team_members').insert({ team_id: teamId, email: email.trim().toLowerCase() });
  if (error?.code === '23505') return;
  fail(error);
}

export const removeMember = async (teamId: string, email: string) =>
  fail((await supabase.from('locker_team_members').delete().eq('team_id', teamId).eq('email', email)).error);
