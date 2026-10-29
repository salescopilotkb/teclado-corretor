/**
 * Onde o usuário vende: define a moeda, o formato dos números e o idioma das
 * mensagens que vão para o cliente (e do corretor do teclado).
 *
 * Os números são formatados à mão (sem Intl): o Hermes do Android não garante
 * todas as moedas e separadores.
 */
import type { Lang } from './index';

export type MarketId = 'BR' | 'US_EN' | 'US_ES' | 'US_PT' | 'PT' | 'ES' | 'MX' | 'AR' | 'CO' | 'CL' | 'UK' | 'CA';

export interface Market {
  id: MarketId;
  /** País (no idioma dele). */
  country: string;
  /** Idioma das mensagens ao cliente e do corretor. */
  language: Lang;
  currency: string;
  symbol: string;
  /** "R$ 10,00" (antes, com espaço), "$10.00" (antes, junto), "10,00 €" (depois). */
  symbolPosition: 'before' | 'after';
  symbolSpace: boolean;
  thousands: string;
  decimal: string;
  decimals: number;
  /** Exemplo de telefone (só para o campo de cadastro). */
  phoneExample: string;
}

export const MARKETS: Market[] = [
  { id: 'US_EN', country: 'United States', language: 'en', currency: 'USD', symbol: '$', symbolPosition: 'before', symbolSpace: false, thousands: ',', decimal: '.', decimals: 2, phoneExample: '(305) 555-0123' },
  { id: 'BR', country: 'Brasil', language: 'pt', currency: 'BRL', symbol: 'R$', symbolPosition: 'before', symbolSpace: true, thousands: '.', decimal: ',', decimals: 2, phoneExample: '(11) 98888-7777' },
  { id: 'US_ES', country: 'Estados Unidos', language: 'es', currency: 'USD', symbol: '$', symbolPosition: 'before', symbolSpace: false, thousands: ',', decimal: '.', decimals: 2, phoneExample: '(305) 555-0123' },
  // Brasileiros que vendem nos EUA: mensagens em português, preços em dólar
  { id: 'US_PT', country: 'Estados Unidos', language: 'pt', currency: 'USD', symbol: 'US$', symbolPosition: 'before', symbolSpace: true, thousands: ',', decimal: '.', decimals: 2, phoneExample: '(305) 555-0123' },
  { id: 'PT', country: 'Portugal', language: 'pt', currency: 'EUR', symbol: '€', symbolPosition: 'after', symbolSpace: true, thousands: ' ', decimal: ',', decimals: 2, phoneExample: '912 345 678' },
  { id: 'ES', country: 'España', language: 'es', currency: 'EUR', symbol: '€', symbolPosition: 'after', symbolSpace: true, thousands: '.', decimal: ',', decimals: 2, phoneExample: '612 34 56 78' },
  { id: 'MX', country: 'México', language: 'es', currency: 'MXN', symbol: '$', symbolPosition: 'before', symbolSpace: false, thousands: ',', decimal: '.', decimals: 2, phoneExample: '55 1234 5678' },
  { id: 'AR', country: 'Argentina', language: 'es', currency: 'ARS', symbol: '$', symbolPosition: 'before', symbolSpace: true, thousands: '.', decimal: ',', decimals: 2, phoneExample: '11 2345-6789' },
  { id: 'CO', country: 'Colombia', language: 'es', currency: 'COP', symbol: '$', symbolPosition: 'before', symbolSpace: true, thousands: '.', decimal: ',', decimals: 0, phoneExample: '300 123 4567' },
  { id: 'CL', country: 'Chile', language: 'es', currency: 'CLP', symbol: '$', symbolPosition: 'before', symbolSpace: true, thousands: '.', decimal: ',', decimals: 0, phoneExample: '9 1234 5678' },
  { id: 'UK', country: 'United Kingdom', language: 'en', currency: 'GBP', symbol: '£', symbolPosition: 'before', symbolSpace: false, thousands: ',', decimal: '.', decimals: 2, phoneExample: '07700 900123' },
  { id: 'CA', country: 'Canada', language: 'en', currency: 'CAD', symbol: 'CA$', symbolPosition: 'before', symbolSpace: false, thousands: ',', decimal: '.', decimals: 2, phoneExample: '(416) 555-0123' },
];

/**
 * DDI do país e quantos dígitos tem um celular sem ele (sem o 0 da frente).
 * Usado para montar o link do WhatsApp quando o número é digitado sem o DDI.
 * Argentina: o WhatsApp pede o 9 de celular depois do 54.
 */
export const DIALING: Record<MarketId, { code: string; national: number }> = {
  BR: { code: '55', national: 11 },
  US_EN: { code: '1', national: 10 },
  US_ES: { code: '1', national: 10 },
  US_PT: { code: '1', national: 10 },
  PT: { code: '351', national: 9 },
  ES: { code: '34', national: 9 },
  MX: { code: '52', national: 10 },
  AR: { code: '549', national: 10 },
  CO: { code: '57', national: 10 },
  CL: { code: '56', national: 9 },
  UK: { code: '44', national: 10 },
  CA: { code: '1', national: 10 },
};

const BY_ID = new Map(MARKETS.map(m => [m.id, m]));

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === 'string' && BY_ID.has(value as MarketId);
}

/** Mercado do usuário; desconhecido (dado antigo) = Brasil. */
export function getMarket(id: MarketId | string | null | undefined): Market {
  return BY_ID.get(id as MarketId) ?? BY_ID.get('BR')!;
}

/** Mercado padrão para quem escolheu um idioma no cadastro. */
export function defaultMarketFor(lang: Lang): MarketId {
  return lang === 'en' ? 'US_EN' : lang === 'es' ? 'US_ES' : 'BR';
}

let currentMarket: MarketId = 'US_EN';

/** Mercado do usuário logado (definido ao carregar o perfil, no app e no teclado). */
export function setCurrentMarket(id: MarketId): void {
  currentMarket = id;
}

export function currentMarketInfo(): Market {
  return getMarket(currentMarket);
}

/** "1.234,56" / "1,234.56" (sem o símbolo). */
export function formatNumber(value: number, market: Market): string {
  const fixed = Math.abs(value).toFixed(market.decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, market.thousands);
  return (value < 0 ? '-' : '') + (dec ? `${grouped}${market.decimal}${dec}` : grouped);
}

/** "R$ 1.234,56", "$1,234.56", "1 234,56 €". */
export function formatMoney(value: number, market: Market): string {
  const number = formatNumber(value, market);
  const space = market.symbolSpace ? ' ' : '';
  return market.symbolPosition === 'before' ? `${market.symbol}${space}${number}` : `${number}${space}${market.symbol}`;
}

/**
 * Campo de valor: a pessoa digita só os números e o valor se monta da direita
 * para a esquerda, como em maquininha (1 → 0,01; 1899 → 18,99). Moedas sem
 * centavos (peso chileno e colombiano) contam em unidades.
 */
export function moneyFromDigits(digits: string, market: Market): number {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  if (!clean) return 0;
  return Number(clean) / 10 ** market.decimals;
}

/** Os dígitos que geram este valor no campo (para editar um preço salvo). */
export function digitsFromMoney(value: number, market: Market): string {
  if (!(value > 0)) return '';
  return String(Math.round(value * 10 ** market.decimals));
}
