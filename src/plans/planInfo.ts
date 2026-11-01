/**
 * O plano da conta, sem nada do aparelho: os tipos, a leitura do que o servidor
 * manda (supabase/plans.sql → my_plan) e o prazo de quem passou do limite. O app
 * (src/plans/plan.ts) e o Locker web (locker/) usam os mesmos.
 */
import { isLockerPlan } from '../files/limits';
import type { LockerPlanId } from '../files/limits';

export type PlanId = LockerPlanId;

/**
 * free · trial (teste de 7 dias do Plus) · active · expired (vencida: 30 dias para salvar)
 * · blocked (dependente com a assinatura da empresa vencida) · open (sem planos no servidor)
 */
export type PlanStatus = 'free' | 'trial' | 'active' | 'expired' | 'blocked' | 'open';

/** O que o plano permite (null = sem limite). Os nomes seguem a tabela plan_limits. */
export interface PlanLimits {
  limitBytes: number | null;
  /** Tamanho máximo de cada arquivo, por tipo (null = o padrão: 16 / 64 / 10 MB) */
  maxImageBytes: number | null;
  maxVideoBytes: number | null;
  maxOtherBytes: number | null;
  maxFiles: number | null;
  maxFolders: number | null;
  maxProducts: number | null;
  maxProductFolders: number | null;
  maxShortcutsPerKind: number | null;
  maxSharePeople: number | null;
  maxTeams: number | null;
  maxDependents: number | null;
  folderLinks: boolean;
  offlineWeb: boolean;
  locker: boolean;
  agenda: boolean;
  crm: boolean;
  trashDays: number;
}

export interface PlanInfo {
  plan: PlanId;
  status: PlanStatus;
  /** owner = a conta que assina; dependent = pessoa da equipe de uma conta empresa */
  role: 'owner' | 'dependent';
  /** Dependente: o nome da empresa */
  companyName: string;
  /** Empresa: quantos dependentes já criou */
  dependents: number;
  store: 'app_store' | 'play_store' | 'manual';
  expiresAt: string | null;
  willRenew: boolean;
  /** Assinatura vencida: até quando os arquivos ficam guardados */
  graceUntil: string | null;
  /** Passa do limite do plano (plano menor ou vencida) */
  overLimit: boolean;
  overLimitSince: string | null;
  limits: PlanLimits;
}

export const OPEN_LIMITS: PlanLimits = {
  limitBytes: null,
  maxImageBytes: null,
  maxVideoBytes: null,
  maxOtherBytes: null,
  maxFiles: null,
  maxFolders: null,
  maxProducts: null,
  maxProductFolders: null,
  maxShortcutsPerKind: null,
  maxSharePeople: null,
  maxTeams: null,
  maxDependents: null,
  folderLinks: true,
  offlineWeb: true,
  locker: true,
  agenda: true,
  crm: true,
  trashDays: 30,
};

export const OPEN: PlanInfo = {
  plan: 'basic',
  status: 'open',
  role: 'owner',
  companyName: '',
  dependents: 0,
  store: 'manual',
  expiresAt: null,
  willRenew: false,
  graceUntil: null,
  overLimit: false,
  overLimitSince: null,
  limits: OPEN_LIMITS,
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function planFromServer(row: Record<string, unknown>): PlanInfo {
  const l = (row.limits ?? {}) as Record<string, unknown>;
  const plan = isLockerPlan(row.plan) ? row.plan : 'free';
  const status = ['free', 'trial', 'active', 'expired', 'blocked'].includes(String(row.status)) ? (row.status as PlanStatus) : 'free';
  const store = row.store === 'app_store' || row.store === 'play_store' ? row.store : 'manual';
  return {
    plan,
    status,
    role: row.role === 'dependent' ? 'dependent' : 'owner',
    companyName: typeof row.company_name === 'string' ? row.company_name : '',
    dependents: Number(row.dependents) || 0,
    store,
    expiresAt: (row.expires_at as string | null) ?? null,
    willRenew: row.will_renew === true,
    graceUntil: (row.grace_until as string | null) ?? null,
    overLimit: row.over_limit === true,
    overLimitSince: (row.over_limit_since as string | null) ?? null,
    limits: {
      limitBytes: num(l.limit_bytes),
      maxImageBytes: num(l.max_image_bytes),
      maxVideoBytes: num(l.max_video_bytes),
      maxOtherBytes: num(l.max_other_bytes),
      maxFiles: num(l.max_files),
      maxFolders: num(l.max_folders),
      maxProducts: num(l.max_products),
      maxProductFolders: num(l.max_product_folders),
      maxShortcutsPerKind: num(l.max_shortcuts_per_kind),
      maxSharePeople: num(l.max_share_people),
      maxTeams: num(l.max_teams),
      maxDependents: num(l.max_dependents),
      folderLinks: l.folder_links === true,
      offlineWeb: l.offline_web === true,
      locker: l.locker === true,
      agenda: l.agenda === true,
      crm: l.crm === true,
      trashDays: num(l.trash_days) ?? 30,
    },
  };
}

const DAY = 24 * 60 * 60 * 1000;
export const OVER_LIMIT_DAYS = 30;

/** Até quando a pessoa pode escolher (null = não passou do limite ou ainda sem data). */
export function overLimitDeadline(plan: PlanInfo): Date | null {
  if (!plan.overLimit || plan.status === 'open') return null;
  if (plan.overLimitSince) return new Date(Date.parse(plan.overLimitSince) + OVER_LIMIT_DAYS * DAY);
  if (plan.graceUntil) return new Date(plan.graceUntil);
  return null;
}

/** Dias que faltam (0 = hoje), arredondando para cima. */
export function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY));
}
