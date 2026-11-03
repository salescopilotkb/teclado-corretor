/**
 * Chaves PÚBLICAS do RevenueCat (SDK do app): RevenueCat → projeto KEYCON → Apps →
 * cada app → "Public API key". Podem ir dentro do app; a chave secreta (sk_...) fica
 * só nos segredos do Supabase.
 *
 * Vazias = cobrança desligada: a tela de planos mostra os preços de tabela e avisa
 * que as assinaturas ainda não abriram.
 */
export const REVENUECAT_KEYS = {
  /** App Store (começa com appl_) */
  ios: '',
  /** Google Play (começa com goog_) */
  android: '',
};

/**
 * Níveis de acesso (entitlements) no RevenueCat: um por plano, com o mesmo nome.
 * O servidor (supabase/functions/_shared/revenuecat.ts) usa os mesmos.
 */
export const ENTITLEMENTS = ['basic', 'plus', 'pro'] as const;
