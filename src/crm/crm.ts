/**
 * Regras do CRM usadas pelo app e pelo teclado.
 */
import { t } from '../i18n';
import { currentMarketInfo, DIALING } from '../i18n/markets';
import type { SegmentProfile } from '../segments/segments';
import type { CRMLead } from '../types';
import { parseISODate, toISODate, todayISO } from '../agenda/agenda';

export function newLeadId(): string {
  return `lead-${Date.now()}`;
}

/** "Ana Souza" → "AS". */
export function initials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "Hoje", "Ontem", "Há 5 dias", "Sem contato". */
export function lastContactLabel(lead: CRMLead): string {
  if (!lead.lastContactAt) return lead.lastContact || t('Sem contato');
  const day = toISODate(new Date(lead.lastContactAt));
  const today = todayISO();
  if (day === today) return t('Hoje');
  const diff = Math.round((parseISODate(today).getTime() - parseISODate(day).getTime()) / 86_400_000);
  if (diff === 1) return t('Ontem');
  return diff > 1 ? t('Há {n} dias', { n: diff }) : t('Hoje');
}

/**
 * Número do WhatsApp só com dígitos e com o DDI, ou null se não parecer um
 * número. Sem "+" e com até os dígitos de um celular do país de quem vende,
 * o DDI desse país entra sozinho: "(11) 98765-4321" → "5511987654321".
 */
export function whatsappNumber(phone: string | undefined): string | null {
  const raw = (phone ?? '').trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  const international = raw.startsWith('+') || digits.startsWith('00');
  digits = digits.replace(/^0+/, '');
  if (!international) {
    const { code, national } = DIALING[currentMarketInfo().id];
    if (digits.length <= national) digits = code + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Link que abre a conversa com o cliente no WhatsApp (ou null sem número válido). */
export function whatsappLink(phone: string | undefined): string | null {
  const digits = whatsappNumber(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

// ── Etiquetas ──────────────────────────────────────────────────────────

/** "  quente " → "Quente" (sem espaços sobrando, primeira letra maiúscula). */
export function cleanTag(tag: string): string {
  const s = tag.trim().replace(/\s+/g, ' ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/** Etiquetas usadas nos clientes, das mais usadas para as menos (sem repetir maiúscula/minúscula). */
export function allTags(leads: CRMLead[] = []): string[] {
  const count = new Map<string, { tag: string; n: number }>();
  for (const l of leads || []) {
    for (const tag of l?.tags ?? []) {
      const key = tag.toLowerCase();
      const entry = count.get(key);
      if (entry) entry.n++;
      else count.set(key, { tag, n: 1 });
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map(e => e.tag);
}

export function hasTag(lead: CRMLead, tag: string): boolean {
  return (lead.tags ?? []).some(x => x.toLowerCase() === tag.toLowerCase());
}

/** Liga/desliga a etiqueta na lista. */
export function toggleTag(tags: string[], tag: string): string[] {
  return tags.some(x => x.toLowerCase() === tag.toLowerCase()) ? tags.filter(x => x.toLowerCase() !== tag.toLowerCase()) : [...tags, tag];
}

/** Cor fixa de cada etiqueta (a mesma no app e no teclado). */
export const TAG_COLORS = ['#E8745F', '#3FA9F5', '#2BB673', '#A66CFF', '#F5A623', '#E05297'];

export function tagColor(tag: string): string {
  let hash = 0;
  for (const ch of tag.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/** Etapas do ramo + as que algum cliente antigo ainda usa (de outro ramo). */
export function stagesFor(segment: SegmentProfile, leads: CRMLead[] = []): string[] {
  const extra = (leads || []).map(l => l.stage).filter(s => s && !segment.crmStages.includes(s));
  return [...segment.crmStages, ...Array.from(new Set(extra))];
}

export function countByStage(leads: CRMLead[] = []): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of (leads || [])) {
    if (l?.stage) out.set(l.stage, (out.get(l.stage) ?? 0) + 1);
  }
  return out;
}

/** Mais recentes primeiro (último contato, depois criação). */
export function sortLeads(leads: CRMLead[]): CRMLead[] {
  const key = (l: CRMLead) => l.lastContactAt ?? l.createdAt ?? '';
  return [...leads].sort((a, b) => key(b).localeCompare(key(a)));
}
