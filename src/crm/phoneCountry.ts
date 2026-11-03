/**
 * País do telefone do cliente (CRM): bandeira, código (DDI) e como achar o país
 * num número colado com o código ("+55 11 98765-4321" → Brasil).
 *
 * O telefone fica guardado num texto só, já com o código: "+55 (11) 98765-4321".
 * Número antigo sem "+" continua valendo (o país é o de quem vende).
 */
import { getLanguage } from '../i18n';
import type { Lang } from '../i18n';
import { currentMarketInfo } from '../i18n/markets';

export interface PhoneCountry {
  /** Código ISO do país ("US", "BR"). */
  iso: string;
  flag: string;
  /** Código de discagem sem o "+" ("1", "55"). */
  dial: string;
  name: Record<Lang, string>;
  /** Dígitos do número no país, sem o código (mínimo e máximo). */
  len: [number, number];
  /** Código +1 dividido (EUA, Canadá, Caribe): os DDDs que são deste país. */
  areaCodes?: string[];
}

const c = (iso: string, flag: string, dial: string, pt: string, en: string, es: string, len: [number, number], areaCodes?: string[]): PhoneCountry => ({
  iso,
  flag,
  dial,
  name: { pt, en, es },
  len,
  areaCodes,
});

/** Os países mais comuns entre os clientes de quem vende nos EUA e na América Latina vêm primeiro. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  c('US', '🇺🇸', '1', 'Estados Unidos', 'United States', 'Estados Unidos', [10, 10]),
  c('MX', '🇲🇽', '52', 'México', 'Mexico', 'México', [10, 10]),
  c('BR', '🇧🇷', '55', 'Brasil', 'Brazil', 'Brasil', [10, 11]),
  c('CA', '🇨🇦', '1', 'Canadá', 'Canada', 'Canadá', [10, 10], [
    '204', '226', '236', '249', '250', '289', '306', '343', '365', '403', '416', '418', '431', '437', '438', '450',
    '506', '514', '519', '548', '579', '581', '587', '604', '613', '639', '647', '672', '705', '709', '778', '780',
    '782', '807', '819', '825', '867', '873', '902', '905',
  ]),
  c('PR', '🇵🇷', '1', 'Porto Rico', 'Puerto Rico', 'Puerto Rico', [10, 10], ['787', '939']),
  c('DO', '🇩🇴', '1', 'República Dominicana', 'Dominican Republic', 'República Dominicana', [10, 10], ['809', '829', '849']),
  c('AR', '🇦🇷', '54', 'Argentina', 'Argentina', 'Argentina', [10, 11]),
  c('CO', '🇨🇴', '57', 'Colômbia', 'Colombia', 'Colombia', [10, 10]),
  c('CL', '🇨🇱', '56', 'Chile', 'Chile', 'Chile', [9, 9]),
  c('PE', '🇵🇪', '51', 'Peru', 'Peru', 'Perú', [9, 9]),
  c('VE', '🇻🇪', '58', 'Venezuela', 'Venezuela', 'Venezuela', [10, 10]),
  c('EC', '🇪🇨', '593', 'Equador', 'Ecuador', 'Ecuador', [9, 9]),
  c('BO', '🇧🇴', '591', 'Bolívia', 'Bolivia', 'Bolivia', [8, 8]),
  c('PY', '🇵🇾', '595', 'Paraguai', 'Paraguay', 'Paraguay', [9, 9]),
  c('UY', '🇺🇾', '598', 'Uruguai', 'Uruguay', 'Uruguay', [8, 8]),
  c('GT', '🇬🇹', '502', 'Guatemala', 'Guatemala', 'Guatemala', [8, 8]),
  c('SV', '🇸🇻', '503', 'El Salvador', 'El Salvador', 'El Salvador', [8, 8]),
  c('HN', '🇭🇳', '504', 'Honduras', 'Honduras', 'Honduras', [8, 8]),
  c('NI', '🇳🇮', '505', 'Nicarágua', 'Nicaragua', 'Nicaragua', [8, 8]),
  c('CR', '🇨🇷', '506', 'Costa Rica', 'Costa Rica', 'Costa Rica', [8, 8]),
  c('PA', '🇵🇦', '507', 'Panamá', 'Panama', 'Panamá', [8, 8]),
  c('CU', '🇨🇺', '53', 'Cuba', 'Cuba', 'Cuba', [8, 8]),
  c('HT', '🇭🇹', '509', 'Haiti', 'Haiti', 'Haití', [8, 8]),
  c('ES', '🇪🇸', '34', 'Espanha', 'Spain', 'España', [9, 9]),
  c('PT', '🇵🇹', '351', 'Portugal', 'Portugal', 'Portugal', [9, 9]),
  c('GB', '🇬🇧', '44', 'Reino Unido', 'United Kingdom', 'Reino Unido', [10, 10]),
  c('IE', '🇮🇪', '353', 'Irlanda', 'Ireland', 'Irlanda', [9, 9]),
  c('FR', '🇫🇷', '33', 'França', 'France', 'Francia', [9, 9]),
  c('DE', '🇩🇪', '49', 'Alemanha', 'Germany', 'Alemania', [10, 11]),
  c('IT', '🇮🇹', '39', 'Itália', 'Italy', 'Italia', [9, 10]),
  c('NL', '🇳🇱', '31', 'Holanda', 'Netherlands', 'Países Bajos', [9, 9]),
  c('BE', '🇧🇪', '32', 'Bélgica', 'Belgium', 'Bélgica', [8, 9]),
  c('CH', '🇨🇭', '41', 'Suíça', 'Switzerland', 'Suiza', [9, 9]),
  c('IL', '🇮🇱', '972', 'Israel', 'Israel', 'Israel', [9, 9]),
  c('AE', '🇦🇪', '971', 'Emirados Árabes', 'United Arab Emirates', 'Emiratos Árabes', [9, 9]),
  c('IN', '🇮🇳', '91', 'Índia', 'India', 'India', [10, 10]),
  c('CN', '🇨🇳', '86', 'China', 'China', 'China', [11, 11]),
  c('JP', '🇯🇵', '81', 'Japão', 'Japan', 'Japón', [10, 10]),
  c('KR', '🇰🇷', '82', 'Coreia do Sul', 'South Korea', 'Corea del Sur', [9, 10]),
  c('PH', '🇵🇭', '63', 'Filipinas', 'Philippines', 'Filipinas', [10, 10]),
  c('AU', '🇦🇺', '61', 'Austrália', 'Australia', 'Australia', [9, 9]),
  c('NZ', '🇳🇿', '64', 'Nova Zelândia', 'New Zealand', 'Nueva Zelanda', [8, 9]),
  c('ZA', '🇿🇦', '27', 'África do Sul', 'South Africa', 'Sudáfrica', [9, 9]),
  c('NG', '🇳🇬', '234', 'Nigéria', 'Nigeria', 'Nigeria', [10, 10]),
  c('AO', '🇦🇴', '244', 'Angola', 'Angola', 'Angola', [9, 9]),
  c('MZ', '🇲🇿', '258', 'Moçambique', 'Mozambique', 'Mozambique', [9, 9]),
];

const BY_ISO = new Map(PHONE_COUNTRIES.map(p => [p.iso, p]));
const US = BY_ISO.get('US')!;

export const countryName = (p: PhoneCountry): string => p.name[getLanguage()] ?? p.name.en;

export const phoneCountryByIso = (iso: string | undefined): PhoneCountry | undefined => (iso ? BY_ISO.get(iso) : undefined);

/** País padrão do telefone: o de quem vende (perfil do app). */
export function defaultPhoneCountry(): PhoneCountry {
  const id = currentMarketInfo().id;
  const iso = id.startsWith('US_') ? 'US' : id === 'UK' ? 'GB' : id;
  return BY_ISO.get(iso) ?? US;
}

/** País pelo código no começo dos dígitos (o mais longo que bate). +1: pelo DDD. */
function byDialPrefix(digits: string, current?: PhoneCountry): { country: PhoneCountry; rest: string } | null {
  for (const size of [3, 2, 1]) {
    const dial = digits.slice(0, size);
    if (dial.length < size) continue;
    const matches = PHONE_COUNTRIES.filter(p => p.dial === dial);
    if (!matches.length) continue;
    const rest = digits.slice(size);
    if (matches.length === 1) return { country: matches[0], rest };
    // +1 (EUA, Canadá, Porto Rico, Rep. Dominicana): o DDD diz qual é
    const area = rest.slice(0, 3);
    const byArea = area.length === 3 ? matches.find(p => p.areaCodes?.includes(area)) : undefined;
    const keep = current && current.dial === dial ? current : undefined;
    return { country: byArea ?? keep ?? matches.find(p => !p.areaCodes) ?? matches[0], rest };
  }
  return null;
}

/**
 * Código +1 (EUA, Canadá, Porto Rico, Rep. Dominicana): ao digitar o DDD, a
 * bandeira acompanha ("416" → Canadá). Os outros países ficam como estão.
 */
export function refineByAreaCode(country: PhoneCountry, national: string): PhoneCountry {
  if (country.dial !== '1') return country;
  const area = national.replace(/\D/g, '').slice(0, 3);
  if (area.length < 3) return country;
  const byArea = PHONE_COUNTRIES.find(p => p.dial === '1' && p.areaCodes?.includes(area));
  if (byArea) return byArea;
  return country.areaCodes ? US : country;
}

/** O que guardar: "+55 (11) 98765-4321" (vazio fica vazio; zero de longa distância sai). */
export function joinPhone(country: PhoneCountry, national: string): string {
  // Código que não está na lista ("+999..."): fica como a pessoa escreveu
  if (national.trim().startsWith('+')) return national.trim();
  const n = national.trim().replace(/^0+/, '').trim();
  if (!n.replace(/\D/g, '')) return '';
  return `+${country.dial} ${n}`;
}

/** Telefone guardado → país e o número sem o código. Sem "+": o país de quem vende. */
export function splitPhone(stored: string | undefined, fallback: PhoneCountry = defaultPhoneCountry()): { country: PhoneCountry; national: string } {
  const raw = intl((stored ?? '').trim());
  if (!raw.startsWith('+')) return { country: fallback, national: raw };
  const digits = raw.replace(/\D/g, '');
  const found = byDialPrefix(digits, fallback);
  if (!found) return { country: fallback, national: raw };
  // Tira o código do começo e mantém o jeito que a pessoa escreveu o resto
  return { country: found.country, national: stripDial(raw, found.country.dial) };
}

/** "0055 11..." → "+55 11..." (o 00 internacional vira "+"). */
const intl = (raw: string) => (raw.startsWith('00') ? `+${raw.slice(2)}` : raw);

/** "+55 (11) 98765-4321" sem o "+55" (mantém o jeito que o resto foi escrito). */
function stripDial(raw: string, dial: string): string {
  let i = 0;
  let seen = 0;
  const s = raw.trim();
  while (i < s.length && seen < dial.length) {
    if (/\d/.test(s[i])) seen++;
    i++;
  }
  return s.slice(i).replace(/^[\s\-.)]+/, '').trim();
}

/**
 * O número digitado ou colado já tem o código do país? Devolve o país e o número sem
 * o código (null = deixa como está). Vale com "+" ou "00" na frente, ou quando um
 * número colado de uma vez tem dígitos demais para o país escolhido.
 */
export function detectPhoneCountry(text: string, current: PhoneCountry, pasted: boolean): { country: PhoneCountry; national: string } | null {
  const raw = intl(text.trim());
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    const found = byDialPrefix(digits, current);
    if (!found) return null;
    return { country: found.country, national: stripDial(raw, found.country.dial) };
  }
  if (!pasted || digits.length <= current.len[1]) return null;
  const found = byDialPrefix(digits, current);
  if (!found || found.rest.length < found.country.len[0] || found.rest.length > found.country.len[1]) return null;
  return { country: found.country, national: stripDial(raw, found.country.dial) };
}
