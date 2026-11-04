/**
 * O plano da conta: o que a pessoa pode usar no app e no teclado.
 *
 * Vem do servidor (supabase/plans.sql → my_plan) e fica guardado no aparelho,
 * para o teclado ler o mesmo e para funcionar sem internet. Atualiza ao abrir o
 * app, ao voltar para ele, ao abrir o teclado e depois de uma compra.
 *
 * Sem assinatura (free): 1 pasta com 3 produtos, 1 pasta com 3 arquivos, 1 atalho
 * de cada formato, sem agenda, CRM e Locker. O que já existe nunca é apagado
 * aqui: passou do limite (plano menor, assinatura vencida), só não cria mais.
 *
 * Servidor sem a tabela de planos (plans.sql ainda não rodou) ou plano nunca lido
 * neste aparelho: "open", nada é limitado (como antes dos planos). Os arquivos o
 * servidor confere de qualquer jeito.
 */
import { t } from '../i18n';
import { supabase } from '../services/supabase';
import { Repo, storage } from '../storage/storage';
import type { ShortcutKind } from '../shortcuts/shortcuts';

export type { PlanId, PlanStatus, PlanLimits, PlanInfo } from './planInfo';
export { OVER_LIMIT_DAYS, daysUntil } from './planInfo';
import { OPEN, overLimitDeadline as deadlineOf, planFromServer as fromServer } from './planInfo';
import type { PlanInfo, PlanLimits } from './planInfo';

const KEY = 'plan.info';

type Stored = { userId: string; info: PlanInfo };

/** O plano guardado neste aparelho (de outra conta ou nunca lido: "open"). */
export function getPlan(): PlanInfo {
  const raw = storage.getString(KEY);
  if (!raw) return OPEN;
  try {
    const stored = JSON.parse(raw) as Stored;
    return stored.userId === Repo.getUserId() ? stored.info : OPEN;
  } catch {
    return OPEN;
  }
}

const listeners = new Set<(plan: PlanInfo) => void>();

export function onPlanChange(fn: (plan: PlanInfo) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Função do servidor ainda não criada (plans.sql não rodou). */
const missingFunction = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST202' || error.code === '42883' || /could not find the function|does not exist/i.test(error.message ?? '');

/**
 * Plano na hora: acompanha a própria linha de locker_plans (compra, renovação,
 * vencimento gravados pelo servidor). Devolve a função que para de acompanhar.
 */
export function watchPlan(userId: string): () => void {
  const channel = supabase
    .channel(`plan-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locker_plans', filter: `user_id=eq.${userId}` }, () => {
      refreshPlan().catch(() => {});
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

let refreshing: Promise<PlanInfo> | null = null;

/** Lê o plano no servidor e guarda. Sem internet: fica o que estava guardado. */
export function refreshPlan(): Promise<PlanInfo> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function doRefresh(): Promise<PlanInfo> {
  const userId = Repo.getUserId();
  if (!userId) return getPlan();
  try {
    const { data, error } = await supabase.rpc('my_plan');
    let info: PlanInfo;
    if (error) {
      if (!missingFunction(error)) return getPlan();
      info = OPEN;
    } else if (!data) {
      return getPlan();
    } else {
      info = fromServer(data as Record<string, unknown>);
    }
    const before = storage.getString(KEY);
    const next = JSON.stringify({ userId, info } satisfies Stored);
    if (before !== next) {
      storage.set(KEY, next);
      listeners.forEach(fn => fn(info));
    }
    return info;
  } catch {
    return getPlan();
  }
}

// ── Abrir a tela de planos de qualquer lugar do app ─────────────────────────

/** plans = Planos e assinatura · keep = escolher o que manter (passou do limite) · company = equipe da empresa */
export type PlanScreen = 'plans' | 'keep' | 'company';

const openers = new Set<(screen: PlanScreen) => void>();

/** O app (App.tsx) registra quem abre a tela de planos. */
export function onOpenPlans(fn: (screen: PlanScreen) => void): () => void {
  openers.add(fn);
  return () => {
    openers.delete(fn);
  };
}

/** Abre a tela de planos (no teclado não há: lá o caminho é abrir o app). */
export function openPlans(): void {
  openers.forEach(fn => fn('plans'));
}

/** Abre a tela "Equipe da empresa" (Plus e Pro: os dependentes). */
export function openCompany(): void {
  openers.forEach(fn => fn('company'));
}

/** A conta tem equipe (Plus, Pro ou Enterprise) e é a que assina. */
export function hasCompany(plan: PlanInfo = getPlan()): boolean {
  if (plan.role !== 'owner' || plan.status === 'open') return false;
  return plan.limits.maxDependents === null ? plan.plan === 'enterprise' : plan.limits.maxDependents > 0;
}

/** Dependente: a conta é da equipe de uma empresa (a assinatura e os dados ficam com ela). */
export function dependentNotice(plan: PlanInfo = getPlan()): string {
  return plan.companyName
    ? t('Sua conta faz parte da equipe de {company}. A assinatura e os dados da empresa ficam com ela. Se você sair da equipe, continua com uma conta própria e pode assinar um plano.', { company: plan.companyName })
    : t('Sua conta faz parte da equipe de uma empresa. A assinatura e os dados da empresa ficam com ela. Se você sair da equipe, continua com uma conta própria e pode assinar um plano.');
}

/** Abre a tela "Escolher o que manter" (passou do limite do plano). */
export function openKeepFiles(): void {
  openers.forEach(fn => fn('keep'));
}

export const canOpenPlans = () => openers.size > 0;

// ── Passou do limite: 30 dias para escolher o que manter ────────────────────

/** Até quando a pessoa pode escolher (null = não passou do limite ou ainda sem data). */
export function overLimitDeadline(plan: PlanInfo = getPlan()): Date | null {
  return deadlineOf(plan);
}

// ── O que a conta pode usar ─────────────────────────────────────────────────

export type PlanFeature = 'agenda' | 'crm' | 'locker' | 'folderLinks' | 'offlineWeb';

export const planAllows = (feature: PlanFeature, plan: PlanInfo = getPlan()): boolean => plan.limits[feature];

export type PlanCounted = 'products' | 'productFolders' | 'files' | 'fileFolders' | ShortcutKind;

function countOf(what: PlanCounted): number {
  switch (what) {
    case 'products':
      return Repo.getFolders().reduce((sum, f) => sum + f.products.length, 0);
    case 'productFolders':
      return Repo.getFolders().length;
    case 'files':
      return Repo.getFiles().files.length;
    case 'fileFolders':
      return Repo.getFiles().folders.length;
    case 'text':
      return Repo.getShortcuts().texts.length;
    case 'audio':
      return Repo.getShortcuts().audios.length;
    case 'link':
      return Repo.getShortcuts().links.length;
  }
}

function maxOf(what: PlanCounted, limits: PlanLimits): number | null {
  switch (what) {
    case 'products':
      return limits.maxProducts;
    case 'productFolders':
      return limits.maxProductFolders;
    case 'files':
      return limits.maxFiles;
    case 'fileFolders':
      return limits.maxFolders;
    default:
      return limits.maxShortcutsPerKind;
  }
}

/** Cabe mais `adding` itens? null = cabe; senão a mensagem para mostrar. */
export function limitError(what: PlanCounted, adding = 1, plan: PlanInfo = getPlan()): string | null {
  const max = maxOf(what, plan.limits);
  if (max === null || countOf(what) + adding <= max) return null;
  return limitMessage(what, max);
}

/** "No plano grátis..." (os limites de contagem só existem no plano grátis) */
export function limitMessage(what: PlanCounted, max: number): string {
  const one = max === 1;
  switch (what) {
    case 'products':
      return one
        ? t('No plano grátis você pode ter 1 produto. Assine um plano para cadastrar mais.')
        : t('No plano grátis você pode ter até {n} produtos. Assine um plano para cadastrar mais.', { n: max });
    case 'productFolders':
      return one
        ? t('No plano grátis você pode ter 1 pasta de produtos. Assine um plano para criar mais.')
        : t('No plano grátis você pode ter até {n} pastas de produtos. Assine um plano para criar mais.', { n: max });
    case 'files':
      return one
        ? t('No plano grátis você pode guardar 1 arquivo. Assine um plano para guardar mais.')
        : t('No plano grátis você pode guardar até {n} arquivos. Assine um plano para guardar mais.', { n: max });
    case 'fileFolders':
      return one
        ? t('No plano grátis você pode ter 1 pasta de arquivos. Assine um plano para criar mais.')
        : t('No plano grátis você pode ter até {n} pastas de arquivos. Assine um plano para criar mais.', { n: max });
    default:
      return one
        ? t('No plano grátis você pode ter 1 atalho de cada tipo (texto, áudio e link). Assine um plano para criar mais.')
        : t('No plano grátis você pode ter até {n} atalhos de cada tipo (texto, áudio e link). Assine um plano para criar mais.', {
            n: max,
          });
  }
}
