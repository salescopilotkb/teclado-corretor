/**
 * Cobrança das assinaturas: só pelas lojas (App Store no iPhone, Google Play no
 * Android), cada uma cuidando das suas. A ligação com as lojas (RevenueCat) entra
 * na tarefa 5; até lá, `loadOffers` devolve null (a tela mostra os preços de
 * tabela) e comprar ou restaurar avisa que as assinaturas ainda não abriram.
 */
import { Linking, Platform } from 'react-native';
import { getLanguage, t } from '../i18n';
import { getPlan, openPlans, refreshPlan } from './plan';
import type { PlanId } from './plan';

/** Os planos que se assinam pela loja (o Enterprise é combinado com o suporte). */
export type PaidPlan = Extract<PlanId, 'basic' | 'plus' | 'pro'>;
export const PAID_PLANS: PaidPlan[] = ['basic', 'plus', 'pro'];

/** Os mesmos códigos nas duas lojas e no RevenueCat. */
export const PRODUCT_IDS: Record<PaidPlan, string> = {
  basic: 'keycon_basic_monthly',
  plus: 'keycon_plus_monthly',
  pro: 'keycon_pro_monthly',
};

/** Preço de tabela em dólar (o da loja, no idioma e na moeda da pessoa, vem com o RevenueCat). */
export const LIST_PRICES_USD: Record<PaidPlan, number> = {
  basic: 24.99,
  plus: 49.99,
  pro: 99.99,
};

/** Só o Plus tem teste grátis (7 dias). */
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN: PaidPlan = 'plus';

/** A loja deste aparelho. */
export const DEVICE_STORE: 'app_store' | 'play_store' = Platform.OS === 'ios' ? 'app_store' : 'play_store';

export interface StoreOffer {
  plan: PaidPlan;
  /** "$24.99", "R$ 129,90"... como a loja mostra */
  price: string;
  /** Pode começar pelo teste grátis (a loja diz se a pessoa ainda tem direito) */
  trial: boolean;
}

export class BillingError extends Error {}

/** Os planos à venda nesta loja. null = loja ainda não ligada (tarefa 5). */
export async function loadOffers(): Promise<StoreOffer[] | null> {
  return null;
}

/** "US$ 24,99" / "$24.99" (preço de tabela, quando a loja não respondeu). */
export function listPrice(plan: PaidPlan): string {
  const value = LIST_PRICES_USD[plan];
  return getLanguage() === 'en' ? `$${value.toFixed(2)}` : `US$ ${value.toFixed(2).replace('.', ',')}`;
}

/** Assina (ou muda para) o plano. 'ok' = comprado; 'cancelled' = a pessoa desistiu na loja. */
export async function purchase(_plan: PaidPlan): Promise<'ok' | 'cancelled'> {
  throw new BillingError(t('As assinaturas ainda não estão abertas. Tente de novo em breve.'));
}

/** Restaurar compras: a loja confere as assinaturas da conta Apple ou Google deste aparelho. */
export async function restorePurchases(): Promise<'restored' | 'nothing'> {
  await refreshPlan();
  throw new BillingError(t('As assinaturas ainda não estão abertas. Tente de novo em breve.'));
}

/** Gerenciar a assinatura: a página de assinaturas da loja onde ela foi feita. */
export function openManageSubscription(): Promise<void> {
  const store = getPlan().store === 'manual' ? DEVICE_STORE : getPlan().store;
  const url =
    store === 'app_store'
      ? 'https://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions?package=com.keycon.app`;
  return Linking.openURL(url);
}

/** A assinatura é de outra loja (assinou no iPhone e está no Android, ou o contrário). */
export function managedElsewhere(): boolean {
  const plan = getPlan();
  return plan.store !== 'manual' && plan.store !== DEVICE_STORE && (plan.status === 'active' || plan.status === 'trial');
}

export { openPlans };
