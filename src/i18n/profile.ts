/**
 * Liga o perfil do usuário aos idiomas e à moeda (app e teclado chamam ao
 * carregar ou trocar o perfil).
 */
import type { SellerProfile } from '../types';
import { setLanguage, setSellingLanguage, setTypingLanguage } from './index';
import { buildCustomMarket, deduceFromMarketId, setActiveCustomMarket, setCurrentMarket } from './markets';

export function applyProfileLanguages(
  profile: Pick<SellerProfile, 'language' | 'market'> & Partial<Pick<SellerProfile, 'country' | 'currency' | 'targetAudience'>>,
): void {
  const deduced = deduceFromMarketId(profile.market);
  const country = profile.country ?? deduced.country;
  const currency = profile.currency ?? deduced.currency;
  const audience = profile.targetAudience ?? deduced.targetAudience;

  const customMarket = buildCustomMarket(country, currency, audience);
  setActiveCustomMarket(customMarket);
  setCurrentMarket(customMarket.id);

  // Idioma das mensagens enviadas ao cliente (catálogo, WhatsApp, CRM, IA)
  setSellingLanguage(customMarket.language);

  // Idioma das telas do aplicativo
  if (profile.language) {
    setLanguage(profile.language);
  }

  // Modelar o teclado: sugestões preditivas, corretor e dicionário ajustados ao público de clientes!
  setTypingLanguage(customMarket.language);
}
