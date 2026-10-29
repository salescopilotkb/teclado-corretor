/**
 * Datas da agenda (app e teclado). Nomes de mês e dia escritos à mão, por
 * idioma: o Intl do Hermes no Android não garante os idiomas.
 */
import { getLanguage, getSellingLanguage, tIn } from '../i18n';
import type { Lang } from '../i18n';
import { currentMarketInfo } from '../i18n/markets';
import type { ScheduleItem } from '../types';

const MONTH_NAMES: Record<Lang, string[]> = {
  pt: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
};
const WEEKDAY_INITIALS: Record<Lang, string[]> = {
  pt: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
};
const WEEKDAY_NAMES: Record<Lang, string[]> = {
  pt: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};

/** "Outubro" / "October" / "Octubre" (0 = janeiro). */
export function monthName(month: number, lang: Lang = getLanguage()): string {
  return MONTH_NAMES[lang][month];
}

/** Iniciais dos dias, de domingo a sábado, para o cabeçalho do calendário. */
export function weekdayInitials(lang: Lang = getLanguage()): string[] {
  return WEEKDAY_INITIALS[lang];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "AAAA-MM-DD" (no fuso do aparelho). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "AAAA-MM-DD" → Date ao meio-dia (longe de virada de dia por horário de verão). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Semanas do mês (domingo a sábado); dias de fora do mês vêm como null. */
export function monthGrid(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(year, month, 1, 12);
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const cells: Array<string | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toISODate(new Date(year, month, day, 12)));
  while (cells.length % 7) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "Hoje", "Amanhã" ou "quinta, 24 de outubro" / "Thursday, October 24". */
export function formatDayLong(iso: string, lang: Lang = getLanguage()): string {
  if (iso === todayISO()) return tIn(lang, 'Hoje');
  if (iso === addDays(todayISO(), 1)) return tIn(lang, 'Amanhã');
  if (iso === addDays(todayISO(), -1)) return tIn(lang, 'Ontem');
  const d = parseISODate(iso);
  const weekday = WEEKDAY_NAMES[lang][d.getDay()];
  const month = MONTH_NAMES[lang][d.getMonth()];
  return lang === 'en' ? `${weekday}, ${month} ${d.getDate()}` : `${weekday}, ${d.getDate()} de ${month.toLowerCase()}`;
}

/** "24/10" (curto, para mensagens); nos EUA, mês antes do dia ("10/24"). */
export function formatDayShort(iso: string): string {
  const d = parseISODate(iso);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  return currentMarketInfo().id.startsWith('US_') ? `${month}/${day}` : `${day}/${month}`;
}

/** Horários sugeridos: 07:00 a 21:30, de meia em meia hora. */
export const TIME_SLOTS: string[] = Array.from({ length: 30 }, (_, i) => `${pad(7 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);

/** Dias que têm algum compromisso (para as bolinhas do calendário). */
export function busyDays(items: ScheduleItem[]): Set<string> {
  return new Set(items.filter(i => !i.done).map(i => i.date));
}

export function itemsOn(items: ScheduleItem[], iso: string): ScheduleItem[] {
  return items.filter(i => i.date === iso);
}

/** Próximos compromissos em aberto (de hoje em diante). */
export function upcoming(items: ScheduleItem[], limit = 3): ScheduleItem[] {
  const today = todayISO();
  return items.filter(i => !i.done && i.date >= today).slice(0, limit);
}

/** Mensagem de confirmação da reunião para inserir na conversa (no idioma de venda). */
export function confirmationMessage(item: ScheduleItem): string {
  const lang = getSellingLanguage();
  const who = item.clientName ? `, ${item.clientName.split(/\s+/)[0]}` : '';
  const day = formatDayLong(item.date, lang);
  // Em inglês o dia da semana fica com maiúscula ("Thursday")
  const when = `${lang === 'en' ? day.replace(/^(Today|Tomorrow|Yesterday)$/, w => w.toLowerCase()) : day.toLowerCase()}${
    item.date !== todayISO() ? ` (${formatDayShort(item.date)})` : ''
  }`;
  const at = item.time ? tIn(lang, ' às {time}', { time: item.time }) : '';
  const base = tIn(lang, 'Olá{who}! Passando para confirmar: {title}, {when}{at}. Tudo certo?', { who, title: item.title, when, at });
  if (item.meetUrl) {
    return `${base}\n${tIn(lang, 'Link da reunião: {url}', { url: item.meetUrl })}`;
  }
  return base;
}

export function newAgendaId(): string {
  return `agenda-${Date.now()}`;
}
