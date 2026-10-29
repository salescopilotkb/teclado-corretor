/**
 * Login do usuário com Supabase Auth (e-mail e senha).
 *
 * O marcador de login usado pelo teclado (Repo auth token) acompanha a sessão
 * do Supabase: é gravado ao entrar / renovar o token e apagado ao sair.
 */
import { t } from '../i18n';
import type { Session } from '@supabase/supabase-js';
import { isSegmentId } from '../segments/segments';
import { isLang } from '../i18n';
import { isMarketId } from '../i18n/markets';
import { Repo } from '../storage/storage';
import type { SellerProfile } from '../types';
import { supabase } from './supabase';
import { DEMO_MODE } from '../config/demo';

export class AuthError extends Error {}

export interface SignUpInput extends SellerProfile {
  email: string;
  password: string;
}

/**
 * Colunas da tabela "profiles". A coluna agency (nome antigo, da época em que o
 * app era só para corretores) guarda o nome do negócio; segment guarda o ramo;
 * language e market, o idioma do usuário e onde ele vende (moeda).
 */
function toProfileRow(profile: SellerProfile) {
  return {
    name: profile.name,
    agency: profile.business,
    phone: profile.phone,
    segment: profile.segment,
    language: profile.language,
    market: profile.market,
  };
}

/** Colunas novas que um banco antigo pode não ter (schema.sql não foi rodado de novo). */
const NEWER_COLUMNS = ['segment', 'language', 'market'] as const;

function isMissingNewerColumn(error: { message: string }): boolean {
  return NEWER_COLUMNS.some(c => new RegExp(c, 'i').test(error.message));
}

/** Traduz as mensagens mais comuns do Supabase para o usuário. */
function friendlyMessage(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) return t('E-mail ou senha incorretos.');
  if (msg.includes('email not confirmed'))
    return t('Confirme seu e-mail pelo link que enviamos antes de entrar.');
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return t('Este e-mail já tem cadastro. Use a opção Entrar.');
  if (msg.includes('password should be at least') || msg.includes('weak password'))
    return t('A senha precisa ter pelo menos 6 caracteres.');
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return t('Informe um e-mail válido.');
  if (msg.includes('rate limit') || msg.includes('too many'))
    return t('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
  if (msg.includes('network request failed') || msg.includes('fetch'))
    return t('Sem conexão com a internet. Verifique e tente de novo.');
  return raw;
}

function fail(error: { message: string }): never {
  throw new AuthError(friendlyMessage(error.message));
}

function applySession(session: Session | null) {
  if (session) Repo.setAuthToken(session.access_token);
  else Repo.clearAuth();
}

/**
 * Os dados do aparelho são de uma conta só. Entrou outra conta: começa do zero
 * (sem herdar produtos e atalhos de quem usou o aparelho antes).
 */
function claimDevice(userId: string, fresh: boolean) {
  const owner = Repo.getUserId();
  if (fresh || (owner && owner !== userId)) Repo.clearUserData();
  Repo.setUserId(userId);
}

/** Mantém o marcador de login (lido pelo teclado) igual à sessão do Supabase. */
export function startAuthSync(): () => void {
  if (DEMO_MODE) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Confere a sessão salva ao abrir o app. Logins antigos de demonstração
 * (antes do Supabase) não têm sessão real e são desfeitos.
 */
export async function restoreSession(): Promise<boolean> {
  if (DEMO_MODE) return Repo.isLoggedIn();
  const { data, error } = await supabase.auth.getSession();
  // Erro (ex.: sem internet para renovar o token): mantém o estado atual
  // em vez de deslogar o usuário
  if (error) return Repo.isLoggedIn();
  applySession(data.session);
  return !!data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) fail(error);
  claimDevice(data.user.id, false);
  applySession(data.session);
  await pullProfile();
}

/**
 * Cria a conta. Com a confirmação de e-mail ligada no Supabase, a sessão só
 * existe depois que o usuário clica no link: nesse caso retorna 'confirm_email'.
 */
export async function signUp(input: SignUpInput): Promise<'signed_in' | 'confirm_email'> {
  const { email, password, ...profile } = input;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // O gatilho handle_new_user (schema.sql) cria a linha em "profiles" com estes dados
    options: { data: toProfileRow(profile) },
  });
  if (error) fail(error);

  // Supabase devolve usuário sem identidades quando o e-mail já existe
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new AuthError(t('Este e-mail já tem cadastro. Use a opção Entrar.'));
  }

  // Conta nova = app limpo e zerado
  if (data.user) claimDevice(data.user.id, true);
  else Repo.clearUserData();
  Repo.setSeller(profile);
  if (!data.session) return 'confirm_email';
  applySession(data.session);
  return 'signed_in';
}

export async function signOut(): Promise<void> {
  // Demonstração: sair recomeça a página com o usuário de exemplo
  if (DEMO_MODE) {
    (globalThis as { location?: { reload(): void } }).location?.reload();
    return;
  }
  // Mesmo sem internet o login local é desfeito
  try {
    await supabase.auth.signOut();
  } finally {
    Repo.clearAuth();
  }
}

/** Baixa o perfil (nome, negócio, telefone, ramo) para o app e o teclado. */
export async function pullProfile(): Promise<SellerProfile | null> {
  if (DEMO_MODE) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  // '*': funciona também em bancos que ainda não têm a coluna segment
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;

  const profile: SellerProfile = {
    name: data.name,
    business: data.agency,
    phone: data.phone,
    // Sem ramo na nuvem, mantém o escolhido neste aparelho
    segment: isSegmentId(data.segment) ? data.segment : Repo.getSegment(),
    // Sem idioma/mercado na nuvem, mantém os escolhidos neste aparelho
    language: isLang(data.language) ? data.language : Repo.getSeller().language,
    market: isMarketId(data.market) ? data.market : Repo.getSeller().market,
  };
  Repo.setSeller(profile);
  return profile;
}

/** Salva o perfil na nuvem (e localmente, para o teclado). */
export async function pushProfile(profile: SellerProfile): Promise<void> {
  if (DEMO_MODE) return;
  Repo.setSeller(profile);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new AuthError(t('Sessão expirada. Entre novamente.'));

  const row = { id: userId, ...toProfileRow(profile), updated_at: new Date().toISOString() };
  let { error } = await supabase.from('profiles').upsert(row);
  if (error && isMissingNewerColumn(error)) {
    // Ramo, idioma e mercado ficam só no aparelho até o banco ganhar as colunas (supabase/schema.sql)
    const { segment: _segment, language: _language, market: _market, ...basic } = row;
    ({ error } = await supabase.from('profiles').upsert(basic));
  }
  if (error) fail(error);
}

/** E-mail da conta logada (tela de Conta). */
export async function currentEmail(): Promise<string | null> {
  if (DEMO_MODE) return 'demo@keyconapp.com';
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}
