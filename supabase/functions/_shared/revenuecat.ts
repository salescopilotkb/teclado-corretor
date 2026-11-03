/**
 * Assinaturas pelo RevenueCat: lê o assinante na API do RevenueCat (a fonte da verdade
 * das lojas) e grava o plano em locker_plans (supabase/plans.sql). Usado pela função
 * "revenuecat-webhook" (a cada aviso) e pela "billing" (o app pede para conferir já).
 *
 * Segredo: REVENUECAT_SECRET_KEY (RevenueCat → Project settings → API keys → chave
 * secreta v1, sk_...). O app usa só as chaves públicas.
 *
 * O app identifica a pessoa no RevenueCat pelo id do Supabase (appUserID). Os níveis de
 * acesso (entitlements) têm o nome do plano: basic, plus, pro.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const API = 'https://api.revenuecat.com/v1';
const RANK: Record<string, number> = { basic: 1, plus: 2, pro: 3 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isAccountId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

type Entitlement = { expires_date: string | null; grace_period_expires_date?: string | null; product_identifier: string };
type Subscription = {
  store?: string;
  period_type?: string;
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  grace_period_expires_date?: string | null;
};
type Subscriber = { entitlements?: Record<string, Entitlement>; subscriptions?: Record<string, Subscription> };

function secret(): string {
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) throw new Error('revenuecat_not_configured');
  return key;
}

async function fetchSubscriber(userId: string): Promise<Subscriber | null> {
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`revenuecat_${res.status}`);
  return ((await res.json()) as { subscriber?: Subscriber }).subscriber ?? null;
}

/** Até quando vale (a carência da loja conta: o cartão falhou, mas a pessoa continua usando). */
const until = (e: { expires_date?: string | null; grace_period_expires_date?: string | null }): number | null => {
  const dates = [e.expires_date, e.grace_period_expires_date].filter(Boolean).map(d => Date.parse(d as string));
  return dates.length ? Math.max(...dates) : null;
};

/**
 * Confere o assinante no RevenueCat e grava o plano. Plano dado à mão pelo suporte
 * (store = manual, sem vencer) não é trocado por uma assinatura já vencida.
 */
export async function syncSubscriber(admin: SupabaseClient, userId: string): Promise<{ plan: string | null; changed: boolean }> {
  if (!isAccountId(userId)) return { plan: null, changed: false };
  const subscriber = await fetchSubscriber(userId);
  const entries = Object.entries(subscriber?.entitlements ?? {}).filter(([id]) => id in RANK);
  if (!entries.length) return { plan: null, changed: false };

  const now = Date.now();
  const active = entries.filter(([, e]) => {
    const end = until(e);
    return end === null || end > now;
  });
  // O plano que vale: o mais alto ativo; sem nenhum ativo, o último que venceu (para os 30 dias)
  const [plan, ent] = active.length
    ? active.sort((a, b) => RANK[b[0]] - RANK[a[0]])[0]
    : entries.sort((a, b) => (until(b[1]) ?? 0) - (until(a[1]) ?? 0))[0];

  const { data: row } = await admin.from('locker_plans').select('plan, store, expires_at').eq('user_id', userId).maybeSingle();
  const manualStillValid = row?.store === 'manual' && (!row.expires_at || Date.parse(row.expires_at) > now) && row.plan !== 'free';
  if (!active.length && manualStillValid) return { plan: row!.plan, changed: false };

  // A assinatura do produto (na Google o código pode vir como "produto:plano-básico")
  const subs = subscriber?.subscriptions ?? {};
  const base = ent.product_identifier.split(':')[0];
  const sub =
    subs[ent.product_identifier] ??
    Object.entries(subs).find(([key]) => key.split(':')[0] === base)?.[1] ??
    ({} as Subscription);
  const end = until(ent);

  const next = {
    user_id: userId,
    plan,
    store: sub.store === 'play_store' ? 'play_store' : sub.store === 'app_store' ? 'app_store' : 'manual',
    product_id: ent.product_identifier,
    period: sub.period_type === 'trial' ? 'trial' : 'normal',
    expires_at: end === null ? null : new Date(end).toISOString(),
    will_renew: !sub.unsubscribe_detected_at,
    event_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('locker_plans').upsert(next, { onConflict: 'user_id' });
  if (error) throw new Error(`save_failed: ${error.message}`);
  return { plan, changed: true };
}

/**
 * Google Play: cancela a RENOVAÇÃO (a pessoa continua com o plano até o fim do período
 * pago, sem reembolso). Usado na troca de Android para iPhone, para não pagar duas vezes.
 * A Apple não permite cancelar por fora: no iPhone, só a própria pessoa cancela.
 */
export async function cancelGoogleRenewal(userId: string, productId: string): Promise<void> {
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(userId)}/subscriptions/${encodeURIComponent(productId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`cancel_failed_${res.status}`);
}
