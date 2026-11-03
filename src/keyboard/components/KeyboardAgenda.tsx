import { t } from '../../i18n';
/**
 * Agenda no teclado expandido: calendário do mês e, embaixo, as tarefas e reuniões
 * (em abas) do mês inteiro. Tocar num dia mostra só as daquele dia; "Mês" volta
 * para o mês todo. Cadastro de reunião ou tarefa. Grava no mesmo lugar que a
 * Agenda do app.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import {
  TIME_SLOTS,
  addDays,
  busyDays,
  confirmationMessage,
  formatDayLong,
  formatDayShort,
  itemsOn,
  monthName,
  newAgendaId,
  todayISO,
} from '../../agenda/agenda';
import { whatsappLink } from '../../crm/crm';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { Repo } from '../../storage/storage';
import type { AgendaKind, CRMLead, ScheduleItem } from '../../types';
import { glassBorder, makeStyles, radius, spacing, touchTarget, useColors } from '../theme';
import { Icon } from './Icon';
import { Header } from './KeyboardCRM';
import { ChoiceRow, KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';
import { MonthCalendar, monthOf } from './MonthCalendar';
import type { CalendarMonth } from './MonthCalendar';
import { ResizeHandle } from './ResizeHandle';

interface Props {
  agenda: ScheduleItem[];
  leads: CRMLead[];
  onInsert: (text: string) => void;
  onClose: () => void;
  onChanged: () => void;
  /** Veio do CRM ("Agendar"): abre direto o cadastro com o cliente. */
  presetClient?: CRMLead | null;
  /** A gaveta foi puxada para baixo: volta ao teclado de letras. */
  onCollapse?: () => void;
}

/** Dia do mês visto para um compromisso novo (hoje, se for o mês de hoje; senão o dia 1). */
function newItemDate(view: CalendarMonth): string {
  const today = todayISO();
  const first = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01`;
  return today.startsWith(first.slice(0, 8)) ? today : first;
}

export function KeyboardAgenda({ agenda = [], leads = [], onInsert, onClose, onChanged, presetClient, onCollapse }: Props) {
  // null = o mês inteiro (ao abrir a aba); um dia = só os compromissos dele
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState(() => monthOf(todayISO()));
  const [form, setForm] = useState<{ item: ScheduleItem | null } | null>(() => (presetClient ? { item: null } : null));

  if (form) {
    return (
      <AgendaForm
        item={form.item}
        date={form.item?.date ?? day ?? newItemDate(view)}
        leads={leads || []}
        presetClient={form.item ? null : presetClient ?? null}
        onCancel={() => setForm(null)}
        onDeleted={() => {
          onChanged();
          setForm(null);
        }}
        onSaved={item => {
          Repo.saveAgendaItem(item);
          onChanged();
          if (day) setDay(item.date);
          setView(monthOf(item.date));
          setForm(null);
        }}
      />
    );
  }

  // Calendário: a barrinha no topo é uma gaveta (puxar para baixo volta ao teclado)
  return (
    <View style={{ flex: 1 }}>
      {onCollapse && <ResizeHandle id="agenda" mode="drawer" onCollapse={onCollapse} />}
    <AgendaCalendar
      agenda={agenda || []}
      leads={leads || []}
      day={day}
      onSelectDay={iso => setDay(d => (d === iso ? null : iso))}
      onMonth={() => setDay(null)}
      view={view}
      onViewChange={v => {
        // Outro mês: volta para a lista do mês inteiro
        setView(v);
        setDay(null);
      }}
      onClose={onClose}
      onNew={() => setForm({ item: null })}
      onEdit={item => setForm({ item })}
      onToggle={item => {
        Repo.saveAgendaItem({ ...item, done: !item.done });
        onChanged();
      }}
      onInsert={onInsert}
    />
    </View>
  );
}

function AgendaCalendar({
  agenda = [],
  leads = [],
  day,
  onSelectDay,
  onMonth,
  view,
  onViewChange,
  onClose,
  onNew,
  onEdit,
  onToggle,
  onInsert,
}: {
  agenda: ScheduleItem[];
  leads: CRMLead[];
  day: string | null;
  onSelectDay: (iso: string) => void;
  onMonth: () => void;
  view: ReturnType<typeof monthOf>;
  onViewChange: (v: ReturnType<typeof monthOf>) => void;
  onClose: () => void;
  onNew: () => void;
  onEdit: (item: ScheduleItem) => void;
  onToggle: (item: ScheduleItem) => void;
  onInsert: (text: string) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const safeAgenda = agenda || [];
  const busy = useMemo(() => busyDays(safeAgenda), [safeAgenda]);
  const [tab, setTab] = useState<AgendaKind>('task');
  // O mês inteiro ou só o dia tocado, em ordem de dia e horário (dia todo primeiro)
  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}-`;
  const scope = (day ? itemsOn(safeAgenda, day) : safeAgenda.filter(i => i.date.startsWith(monthPrefix))).sort(
    (x, y) => x.date.localeCompare(y.date) || (x.time ?? '').localeCompare(y.time ?? ''),
  );
  const count = { task: scope.filter(i => i.kind === 'task').length, meeting: scope.filter(i => i.kind === 'meeting').length };
  const shown = scope.filter(i => i.kind === tab);
  const empty = day
    ? tab === 'task'
      ? t('Nenhuma tarefa neste dia. Toque em "Novo" para agendar.')
      : t('Nenhuma reunião neste dia. Toque em "Novo" para agendar.')
    : tab === 'task'
      ? t('Nenhuma tarefa neste mês. Toque em "Novo" para agendar.')
      : t('Nenhuma reunião neste mês. Toque em "Novo" para agendar.');

  const confirmMeeting = (item: ScheduleItem) => {
    const message = confirmationMessage(item);
    const phone = item.clientPhone || (item.clientId ? leads.find(l => l.id === item.clientId)?.phone : undefined);
    const link = whatsappLink(phone, message);
    if (link) {
      KeyboardBridge.openUrl(link).catch(() => onInsert(message));
    } else {
      onInsert(message);
    }
  };

  return (
    <View style={styles.flex}>
      <Header title={t('Agenda')} onBack={onClose} actionLabel={t('Novo')} onAction={onNew} />
      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="always"
        ListHeaderComponent={
          <View style={styles.calendarBox}>
            <MonthCalendar view={view} onViewChange={onViewChange} selected={day ?? ''} onSelect={onSelectDay} busy={busy} compact />
            <View style={styles.scopeRow}>
              <Text style={styles.dayTitle} numberOfLines={1}>
                {day ? formatDayLong(day) : `${monthName(view.month)} ${view.year}`}
              </Text>
              {/* Dia escolhido: "Mês" volta para os compromissos do mês inteiro */}
              {day ? (
                <Pressable testID="agenda-month" accessibilityRole="button" hitSlop={8} style={styles.monthBtn} onPress={onMonth}>
                  <Icon name="calendario" size={14} color={colors.primaryText} />
                  <Text style={styles.monthBtnText}>{t('Mês')}</Text>
                </Pressable>
              ) : null}
            </View>
            {/* Abas: tarefas e reuniões (com quantas há no mês ou no dia) */}
            <View style={styles.tabs}>
              {(['task', 'meeting'] as AgendaKind[]).map(k => {
                const on = tab === k;
                return (
                  <Pressable
                    key={k}
                    testID={`agenda-tab-${k}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && styles.tabOn]}
                    onPress={() => setTab(k)}>
                    <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                      {k === 'task' ? t('Tarefas') : t('Reuniões')} ({count[k]})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.item, item.done && styles.itemDone]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              hitSlop={8}
              style={[styles.check, item.done && styles.checkOn]}
              onPress={() => onToggle(item)}>
              {item.done && <Icon name="check" size={14} color={colors.onPrimary} />}
            </Pressable>
            <Pressable style={styles.flex} onPress={() => onEdit(item)}>
              <Text style={[styles.itemTitle, item.done && styles.itemTitleDone]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {day ? '' : `${formatDayShort(item.date)} · `}
                {item.time ? item.time : t('Dia todo')}
                {item.clientName ? ` · ${item.clientName}` : ''}
                {item.clientPhone ? ` · ${item.clientPhone}` : ''}
              </Text>
            </Pressable>
            {item.kind === 'meeting' && !item.done && (
              <Pressable accessibilityLabel={t('Enviar confirmação')} style={styles.send} onPress={() => confirmMeeting(item)}>
                <Icon name="respostas" size={16} color={colors.primaryText} />
                <Text style={styles.sendText}>{t('Confirmar')}</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const AGENDA_FIELDS: FormFieldSpec[] = [
  { key: 'title', label: 'Título', placeholder: 'Ex.: Reunião de apresentação' },
  { key: 'clientPhone', label: 'WhatsApp', placeholder: 'Ex.: +55 11 99999-9999', kind: 'phone' },
  { key: 'notes', label: 'Assunto', placeholder: 'Opcional' },
];

function AgendaForm({
  item,
  date: initialDate,
  leads,
  presetClient,
  onCancel,
  onDeleted,
  onSaved,
}: {
  item: ScheduleItem | null;
  date: string;
  leads: CRMLead[];
  presetClient: CRMLead | null;
  onCancel: () => void;
  onDeleted: () => void;
  onSaved: (item: ScheduleItem) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [kind, setKind] = useState<AgendaKind>(item?.kind ?? 'meeting');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState<string>(item?.time ?? '');
  const [clientId, setClientId] = useState<string>(item?.clientId ?? presetClient?.id ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useKeyboardForm(AGENDA_FIELDS, {
    title: item?.title ?? (presetClient ? t('Reunião com {clientName}', { clientName: presetClient.clientName }) : ''),
    clientPhone: item?.clientPhone ?? presetClient?.phone ?? '',
    notes: item?.notes ?? '',
  });
  const title = form.values.title.trim();

  const save = () => {
    if (!title) return;
    const client = leads.find(l => l.id === clientId);
    onSaved({
      id: item?.id ?? newAgendaId(),
      kind,
      title,
      date,
      time: time || undefined,
      clientId: client?.id,
      clientName: client?.clientName,
      clientPhone: form.values.clientPhone?.trim() || client?.phone || undefined,
      // Google Meet desligado por enquanto: só preserva o link de compromissos antigos
      meetUrl: item?.meetUrl,
      notes: form.values.notes.trim() || undefined,
      done: item?.done ?? false,
    });
  };

  return (
    <View style={styles.flex}>
      <Header title={item ? t('Editar compromisso') : t('Novo compromisso')} onBack={onCancel} actionLabel={t('Salvar')} onAction={save} disabled={!title} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
        <ChoiceRow
          options={[
            { value: 'meeting' as AgendaKind, label: t('Reunião') },
            { value: 'task' as AgendaKind, label: t('Tarefa') },
          ]}
          value={kind}
          onChange={setKind}
        />
        {AGENDA_FIELDS.map(f => (
          <KeyboardFormField key={f.key} spec={f} value={form.values[f.key] ?? ''} active={form.active === f.key} onPress={() => form.setActive(f.key)} />
        ))}

        {/* Dia: setas para trocar sem abrir outro calendário */}
        <View style={styles.dateRow}>
          <Pressable accessibilityLabel={t('Dia anterior')} hitSlop={8} style={styles.dateNav} onPress={() => setDate(d => addDays(d, -1))}>
            <Icon name="voltar" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.dateText}>{formatDayLong(date)}</Text>
          <Pressable accessibilityLabel={t('Próximo dia')} hitSlop={8} style={styles.dateNav} onPress={() => setDate(d => addDays(d, 1))}>
            <Icon name="avancar" size={18} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.section}>{t('Horário')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
          <ChoiceRow options={[{ value: '', label: t('Dia todo') }, ...TIME_SLOTS.map(t => ({ value: t, label: t }))]} value={time} onChange={setTime} />
        </ScrollView>

        {leads.length > 0 && (
          <>
            <Text style={styles.section}>{t('Cliente')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
              <ChoiceRow
                options={[{ value: '', label: t('Nenhum') }, ...leads.map(l => ({ value: l.id, label: l.clientName }))]}
                value={clientId}
                onChange={newId => {
                  setClientId(newId);
                  if (!form.values.clientPhone) {
                    const lead = leads.find(l => l.id === newId);
                    if (lead?.phone) form.setValue('clientPhone', lead.phone);
                  }
                }}
              />
            </ScrollView>
          </>
        )}

        {item && (
          <Pressable
            style={styles.deleteBtn}
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              Repo.deleteAgendaItem(item.id);
              onDeleted();
            }}>
            <Text style={styles.deleteText}>{confirmDelete ? t('Toque de novo para excluir') : t('Excluir compromisso')}</Text>
          </Pressable>
        )}
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey={form.active} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  calendarBox: { backgroundColor: colors.surface, ...glassBorder(colors), borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.xs },
  dayTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, minHeight: 32 },
  monthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  monthBtnText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
  tabs: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  tab: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextOn: { color: colors.onPrimary },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: touchTarget + 12,
  },
  itemDone: { opacity: 0.6 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemTitleDone: { textDecorationLine: 'line-through' },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  send: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    minHeight: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  sendText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
  form: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.xs },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: touchTarget,
  },
  dateNav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 15, fontWeight: '600', color: colors.text },
  deleteBtn: { alignSelf: 'center', padding: spacing.md },
  deleteText: { fontSize: 14, fontWeight: '600', color: colors.danger },
}));
