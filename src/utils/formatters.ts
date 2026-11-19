/**
 * Formatadores de mensagens — Minimalista, sem emojis.
 */
import { getLanguage, getSellingLanguage, tIn } from '../i18n';
import type { Lang } from '../i18n';
import { currentMarketInfo, formatMoney } from '../i18n/markets';
import { getSegment } from '../segments/segments';
import type { SegmentProfile } from '../segments/segments';
import type { Product, ProductAttribute, ProductFolder, SegmentId, SellerProfile } from '../types';

type SegmentRef = SegmentId | SegmentProfile;

/** O ramo no idioma pedido (aceita o id ou o perfil já carregado). */
function segmentIn(segment: SegmentRef, lang: Lang): SegmentProfile {
  return getSegment(typeof segment === 'string' ? segment : segment.id, lang);
}

/** Valor na moeda de quem vende: "R$ 1.234,56", "$1,234.56", "1.234,56 €". */
export function formatCurrency(value: number): string {
  return formatMoney(value, currentMarketInfo());
}

/**
 * Preço como o ramo mostra: "R$ 450.000,00", "a partir de R$ 89,90/mês",
 * "R$ 2.500,00/mês" (locação). Preço 0 = "Sob consulta".
 * lang: idioma do texto (padrão: o das telas; mensagens ao cliente usam o de venda).
 */
export function formatPrice(
  p: Pick<Product, 'price' | 'attributes'>,
  segment: SegmentRef = 'general',
  lang: Lang = getLanguage(),
): string {
  if (!(p.price > 0)) return tIn(lang, 'Sob consulta');
  const { prefix, suffix } = segmentIn(segment, lang).price;
  const after = typeof suffix === 'function' ? suffix(p) : suffix ?? '';
  return `${prefix ? `${prefix} ` : ''}${formatCurrency(p.price)}${after}`;
}

/**
 * "Área: 85 m²" (a unidade vem do campo do ramo, quando houver). O nome do
 * campo e as opções (Venda, Locação...) saem no idioma pedido.
 */
export function formatAttribute(a: ProductAttribute, segment: SegmentRef = 'general', lang: Lang = getLanguage()): string {
  const field = segmentIn(segment, lang).fields.find(f => f.key === a.key);
  const label = field?.label ?? tIn(lang, a.label);
  const value = field?.options ? tIn(lang, a.value) : a.value;
  return `${label}: ${value}${field?.unit ? ` ${field.unit}` : ''}`;
}

/** Características preenchidas do produto, já formatadas. */
export function attributeLines(p: Pick<Product, 'attributes'>, segment: SegmentRef = 'general', lang: Lang = getLanguage()): string[] {
  return (p.attributes ?? []).filter(a => a.value.trim()).map(a => formatAttribute(a, segment, lang));
}

/** Mensagem limpa para envio no WhatsApp (sem emojis), no idioma de venda. */
export function formatProductMessage(p: Product, folder?: ProductFolder, segment: SegmentRef = 'general'): string {
  const lang = getSellingLanguage();
  const details = attributeLines(p, segment, lang);
  return [
    `*${p.title}*`,
    folder ? folder.name : null,
    `*${formatPrice(p, segment, lang)}*`,
    ...(details.length ? ['', ...details] : []),
    '',
    p.shortDescription,
    // Sem link cadastrado, a mensagem termina na descrição
    ...(p.datasheetUrl ? ['', tIn(lang, 'Veja mais: {url}', { url: p.datasheetUrl })] : []),
  ]
    .filter(line => line !== null)
    .join('\n')
    // Descrição vazia não deixa linha em branco sobrando
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Mensagem de retorno do CRM ({{cliente}} = nome do cliente), no idioma de venda. */
/** Variável da mensagem de retorno que vira o nome do cliente. */
export const CLIENT_VAR = '{{cliente}}';

/** Mensagem de retorno padrão do ramo, no idioma de venda (com {{cliente}}). */
export function defaultFollowUp(segment: SegmentId): string {
  return getSegment(segment, getSellingLanguage()).followUp;
}

/**
 * Mensagem de retorno pronta para o cliente: a que a pessoa escreveu no app (ou a
 * padrão do ramo), com {{cliente}} trocado pelo nome e, com o perfil, também
 * {{nome}}, {{empresa}} e {{telefone}}.
 */
export function formatFollowUp(clientName: string, segment: SegmentId, template = '', seller?: SellerProfile): string {
  const body = (template.trim() ? template : defaultFollowUp(segment)).replace(/\{\{cliente\}\}/g, clientName);
  return seller ? applyTemplate(body, seller) : body;
}

/**
 * Normaliza um link colado pelo usuário (Drive, Dropbox, site da loja…).
 * Aceita com ou sem "https://". Retorna null se não parecer um link válido.
 */
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return /^https?:\/\/[^/.\s]+\.\S+/i.test(withScheme) ? withScheme : null;
}

/**
 * Substitui {{variáveis}} das mensagens prontas pelos dados do perfil.
 * {{corretor}} e {{imobiliaria}} continuam valendo para mensagens antigas.
 */
export function applyTemplate(body: string, seller: SellerProfile): string {
  const vars: Record<string, string> = {
    nome: seller.name,
    empresa: seller.business,
    telefone: seller.phone,
    corretor: seller.name,
    imobiliaria: seller.business,
    creci: '',
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}
