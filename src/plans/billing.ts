/**
 * Cobrança das assinaturas: só pelas lojas (App Store no iPhone, Google Play no
 * Android), cada uma cuidando das suas, pelo RevenueCat (react-native-purchases).
 *
 * A conta da loja fica presa à conta KEYCON: o RevenueCat usa o id do Supabase
 * (appUserID). A cada compra, renovação, cancelamento ou vencimento, o RevenueCat
 * avisa o servidor (supabase/functions/revenuecat-webhook), que grava o plano em
 * locker_plans; o app relê o plano na hora (watchPlan).
 *
 * Sem as chaves públicas (src/config/revenuecat.ts): cobrança desligada, a tela
 * mostra os preços de tabela e avisa que as assinaturas ainda não abriram.
 */
import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { getLanguage, t } from '../i18n';
import { REVENUECAT_KEYS } from '../config/revenuecat';
import { supabase } from '../services/supabase';
import { getPlan, openPlans, refreshPlan } from './plan';
import type { PlanId, PlanInfo } from './plan';

/** Os planos que se assinam pela loja (o Enterprise é combinado com o suporte). */
export type PaidPlan = Extract<PlanId, 'basic' | 'plus' | 'pro'>;
export const PAID_PLANS: PaidPlan[] = ['basic', 'plus', 'pro'];
const RANK: Record<PaidPlan, number> = { basic: 1, plus: 2, pro: 3 };

/** Os mesmos códigos nas duas lojas e no RevenueCat (na Google, com o plano básico "monthly"). */
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

const apiKey = (): string => (Platform.OS === 'ios' ? REVENUECAT_KEYS.ios : Platform.OS === 'android' ? REVENUECAT_KEYS.android : '');

/** A cobrança está ligada neste aparelho (há a chave da loja dele). */
export const billingEnabled = (): boolean => !!apiKey();

const closed = () => new BillingError(t('As assinaturas ainda não estão abertas. Tente de novo em breve.'));

// ── Ligar a conta KEYCON ao RevenueCat ──────────────────────────────────────

let configuredFor: string | null = null;

/** Ao entrar na conta: a loja passa a conhecer a pessoa pelo id do KEYCON. */
export async function startBilling(userId: string): Promise<void> {
  if (!billingEnabled() || !userId) return;
  try {
    if (!configuredFor) {
      Purchases.configure({ apiKey: apiKey(), appUserID: userId });
      // Renovou, cancelou ou comprou noutro lugar: o servidor recebe e o app relê
      Purchases.addCustomerInfoUpdateListener(() => {
        refreshPlan().catch(() => {});
      });
    } else if (configuredFor !== userId) {
      await Purchases.logIn(userId);
    }
    configuredFor = userId;
  } catch {
    // Sem a loja (aparelho sem Google Play, por exemplo): a cobrança fica desligada
  }
}

/** Ao sair da conta: a próxima pessoa não herda a assinatura desta. */
export async function stopBilling(): Promise<void> {
  if (!configuredFor) return;
  try {
    await Purchases.logOut();
  } catch {
    // já era anônimo
  }
  configuredFor = null;
}

// ── Planos à venda ──────────────────────────────────────────────────────────

/** O pacote da loja de cada plano (na Google o código vem como "produto:plano-básico"). */
async function packages(): Promise<Partial<Record<PaidPlan, PurchasesPackage>>> {
  const offerings = await Purchases.getOfferings();
  const all = offerings.current?.availablePackages ?? [];
  const out: Partial<Record<PaidPlan, PurchasesPackage>> = {};
  for (const plan of PAID_PLANS) {
    const pkg = all.find(p => p.product.identifier.split(':')[0] === PRODUCT_IDS[plan]);
    if (pkg) out[plan] = pkg;
  }
  return out;
}

/** Os planos à venda nesta loja, com o preço dela. null = cobrança desligada ou loja fora do ar. */
export async function loadOffers(): Promise<StoreOffer[] | null> {
  if (!billingEnabled() || !configuredFor) return null;
  try {
    const pkgs = await packages();
    // Teste grátis: na Google a oferta só vem para quem tem direito; na Apple, pergunta
    let iosEligible: Record<string, { status: number }> = {};
    if (Platform.OS === 'ios') {
      const ids = Object.values(pkgs).map(p => p!.product.identifier);
      iosEligible = ids.length ? await Purchases.checkTrialOrIntroductoryPriceEligibility(ids) : {};
    }
    const offers = PAID_PLANS.flatMap<StoreOffer>(plan => {
      const pkg = pkgs[plan];
      if (!pkg) return [];
      const product = pkg.product;
      const trial =
        Platform.OS === 'ios'
          ? !!product.introPrice && iosEligible[product.identifier]?.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
          : !!product.defaultOption?.freePhase;
      return [{ plan, price: product.priceString, trial }];
    });
    return offers.length ? offers : null;
  } catch {
    return null;
  }
}

/** "US$ 24,99" / "$24.99" (preço de tabela, quando a loja não respondeu). */
export function listPrice(plan: PaidPlan): string {
  const value = LIST_PRICES_USD[plan];
  return getLanguage() === 'en' ? `$${value.toFixed(2)}` : `US$ ${value.toFixed(2).replace('.', ',')}`;
}

// ── Comprar, restaurar e acompanhar ─────────────────────────────────────────

/** O plano da loja que está valendo agora (o mais alto), com o produto dele. */
function activeStorePlan(info: CustomerInfo): { plan: PaidPlan; product: string } | null {
  let best: { plan: PaidPlan; product: string } | null = null;
  for (const plan of PAID_PLANS) {
    const ent = info.entitlements.active[plan];
    if (ent && (!best || RANK[plan] > RANK[best.plan])) best = { plan, product: ent.productIdentifier.split(':')[0] };
  }
  return best;
}

/**
 * O aviso da loja chega ao servidor pelo RevenueCat em alguns segundos: até lá, pede
 * ao servidor para conferir já (função "billing", ação sync) e relê o plano.
 */
async function syncPlan(expect?: (p: PlanInfo) => boolean): Promise<PlanInfo> {
  for (let i = 0; i < 6; i++) {
    try {
      await supabase.functions.invoke('billing', { body: { action: 'sync' } });
    } catch {
      // sem internet: tenta de novo
    }
    const plan = await refreshPlan();
    if (!expect || expect(plan)) return plan;
    await new Promise(r => setTimeout(r, 1500));
  }
  return refreshPlan();
}

/**
 * Assina (ou muda para) o plano. 'ok' = comprado; 'cancelled' = a pessoa desistiu na
 * loja. Na Google, trocar de plano usa a troca da própria loja: subir vale na hora (e
 * desconta o que sobrou), descer vale na próxima renovação.
 */
export async function purchase(plan: PaidPlan): Promise<'ok' | 'cancelled'> {
  if (!billingEnabled() || !configuredFor) throw closed();
  const pkg = (await packages().catch(() => ({}) as Partial<Record<PaidPlan, PurchasesPackage>>))[plan];
  if (!pkg) throw new BillingError(t('Este plano ainda não está à venda nesta loja. Tente de novo em breve.'));
  try {
    let change: Parameters<typeof Purchases.purchasePackage>[2] = null;
    if (Platform.OS === 'android') {
      const current = activeStorePlan(await Purchases.getCustomerInfo());
      if (current && current.plan !== plan) {
        change = {
          oldProductIdentifier: current.product,
          replacementMode:
            RANK[plan] > RANK[current.plan] ? Purchases.STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION : Purchases.STORE_REPLACEMENT_MODE.DEFERRED,
        };
      }
    }
    await Purchases.purchasePackage(pkg, null, change);
  } catch (e) {
    if ((e as { userCancelled?: boolean | null })?.userCancelled) return 'cancelled';
    throw new BillingError(t('Não foi possível concluir a assinatura. Tente de novo.'));
  }
  await syncPlan(p => p.plan === plan || p.status === 'trial');
  return 'ok';
}

/** Restaurar compras: a loja confere as assinaturas da conta Apple ou Google deste aparelho. */
export async function restorePurchases(): Promise<'restored' | 'nothing'> {
  if (!billingEnabled() || !configuredFor) throw closed();
  try {
    const info = await Purchases.restorePurchases();
    if (!activeStorePlan(info)) {
      await syncPlan();
      return 'nothing';
    }
  } catch {
    throw new BillingError(t('Não foi possível restaurar agora. Tente de novo.'));
  }
  await syncPlan(p => p.status === 'active' || p.status === 'trial');
  return 'restored';
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

/**
 * Troca de Android para iPhone: o servidor cancela a RENOVAÇÃO na Google Play (o plano
 * vale até o fim do período já pago, sem cobrança dupla). Depois dessa data, a pessoa
 * assina pela App Store. Devolve até quando o plano vale.
 */
export async function moveFromGoogle(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ until?: string | null }>('billing', { body: { action: 'cancel_google' } });
  if (error) throw new BillingError(t('Não foi possível cancelar a renovação na Google Play agora. Tente de novo.'));
  await syncPlan();
  return data?.until ?? null;
}

/** A assinatura é de outra loja (assinou no iPhone e está no Android, ou o contrário). */
export function managedElsewhere(): boolean {
  const plan = getPlan();
  return plan.store !== 'manual' && plan.store !== DEVICE_STORE && (plan.status === 'active' || plan.status === 'trial');
}

export { openPlans };
