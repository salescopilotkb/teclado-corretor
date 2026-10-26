/**
 * CRM no teclado expandido: funil por etapa, etiquetas, clientes, ficha do
 * cliente e cadastro. "Conversar" abre a conversa do cliente no WhatsApp (o
 * número vira um link wa.me). Tudo grava no mesmo armazenamento do app (Repo).
 */
import { t } from '../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { formatDayLong, upcoming } from '../../agenda/agenda';
import {
  allTags,
  cleanTag,
  countByStage,
  hasTag,
  initials,
  lastContactLabel,
  newLeadId,
  sortLeads,
  stagesFor,
  toggleTag,
  whatsappLink,
} from '../../crm/crm';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { SegmentProfile } from '../../segments/segments';
import { Repo } from '../../storage/storage';
import type { CRMLead, ScheduleItem } from '../../types';
import { formatFollowUp } from '../../utils/formatters';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, useColors } from '../theme';
import { CoralSheen } from './Glass';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { ActionButton, UseButton } from './KeyboardButtons';
import { ChoiceRow, KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';
import { MAX_RESULTS, NoResults, SearchLauncher, SearchPanel, matches } from './KeyboardSearch';
import { TagFilter, TagList, TagPicker } from './TagChips';

interface Props {
  segment: SegmentProfile;
  leads: CRMLead[];
  agenda: ScheduleItem[];
  /** Insere na conversa (e o teclado volta ao tamanho normal). */
  onInsert: (text: string) => void;
  onClose: () => void;
  /** Depois de gravar: relê os dados. */
  onChanged: () => void;
  /** Abre a agenda com um compromisso novo para o cliente. */
  onSchedule: (lead: CRMLead) => void;
}

type View_ = { name: 'list' } | { name: 'search' } | { name: 'detail'; id: string } | { name: 'form'; id: string | null };

export function KeyboardCRM({ segment, leads = [], agenda = [], onInsert, onClose, onChanged, onSchedule }: Props) {
  const [view, setView] = useState<View_>({ name: 'list' });
  const safeLeads = leads || [];
  const safeAgenda = agenda || [];

  /** "Conversar": abre a conversa no WhatsApp e registra o contato de hoje. */
  const talk = (lead: CRMLead) => {
    const link = whatsappLink(lead.phone);
    if (!link) return;
    // Sem app para abrir o link: põe o link na conversa atual
    KeyboardBridge.openUrl(link).catch(() => onInsert(link));
    Repo.saveLead({ ...lead, lastContactAt: new Date().toISOString() });
    onChanged();
  };

  if (view.name === 'search') {
    return (
      <SearchPanel testID="crm-search" placeholder={t('Buscar clientes')} onClose={() => setView({ name: 'list' })}>
        {query => {
          const digits = query.replace(/\D/g, '');
          const found = sortLeads(safeLeads)
            .filter(
              l =>
                matches(query, l.clientName, l.notes, l.stage, t(l.stage), ...(l.tags ?? [])) ||
                // Telefone: acha pelos números, com ou sem espaço e traço
                (digits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(digits)),
            )
            .slice(0, MAX_RESULTS);
          if (!found.length) return <NoResults query={query} />;
          return found.map(item => (
            <LeadRow
              key={item.id}
              lead={item}
              testID={`search-lead-${item.id}`}
              onPress={() => setView({ name: 'detail', id: item.id })}
              onTalk={() => talk(item)}
            />
          ));
        }}
      </SearchPanel>
    );
  }

  if (view.name === 'form') {
    const editing = view.id ? safeLeads.find(l => l.id === view.id) ?? null : null;
    return (
      <LeadForm
        segment={segment}
        lead={editing}
        onCancel={() => setView(editing ? { name: 'detail', id: editing.id } : { name: 'list' })}
        tags={allTags(safeLeads)}
        onSaved={lead => {
          Repo.saveLead(lead);
          onChanged();
          setView({ name: 'detail', id: lead.id });
        }}
      />
    );
  }

  if (view.name === 'detail') {
    const lead = safeLeads.find(l => l.id === view.id);
    if (lead) {
      return (
        <LeadDetail
          segment={segment}
          lead={lead}
          stages={stagesFor(segment, safeLeads)}
          agenda={safeAgenda.filter(a => a.clientId === lead.id)}
          onBack={() => setView({ name: 'list' })}
          onEdit={() => setView({ name: 'form', id: lead.id })}
          onSave={l => {
            Repo.saveLead(l);
            onChanged();
          }}
          onDelete={() => {
            Repo.deleteLead(lead.id);
            onChanged();
            setView({ name: 'list' });
          }}
          onInsert={onInsert}
          onSchedule={() => onSchedule(lead)}
          onTalk={() => talk(lead)}
          tags={allTags(safeLeads)}
        />
      );
    }
  }

  return (
    <LeadList
      segment={segment}
      leads={safeLeads}
      onClose={onClose}
      onOpen={id => setView({ name: 'detail', id })}
      onNew={() => setView({ name: 'form', id: null })}
      onSearch={() => setView({ name: 'search' })}
      onTalk={talk}
    />
  );
}

// ── Lista + funil ───────────────────────────────────────────────────────

function LeadList({
  segment,
  leads = [],
  onClose,
  onOpen,
  onNew,
  onSearch,
  onTalk,
}: {
  segment: SegmentProfile;
  leads: CRMLead[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSearch: () => void;
  onTalk: (lead: CRMLead) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const safeLeads = leads || [];
  const [stage, setStage] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const stages = stagesFor(segment, safeLeads);
  const counts = countByStage(safeLeads);
  const tags = allTags(safeLeads);
  const shown = useMemo(
    () => sortLeads(safeLeads.filter(l => (!stage || l.stage === stage) && (!tag || hasTag(l, tag)))),
    [safeLeads, stage, tag],
  );

  return (
    <View style={styles.flex}>
      <Header title={t('Clientes')} count={safeLeads.length} onBack={onClose} actionLabel={t('Novo cliente')} onAction={onNew} />
      <SearchLauncher testID="crm-search-open" placeholder={t('Buscar clientes')} onPress={onSearch} />

      {/* Funil: uma "coluna" por etapa, com a quantidade */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.funnelScroll}
        contentContainerStyle={styles.funnel}
        keyboardShouldPersistTaps="always">
        <StageTab label={t('Todos')} count={leads.length} active={stage === null} onPress={() => setStage(null)} />
        {stages.map((s, i) => (
          <StageTab key={s} index={i + 1} label={t(s)} count={counts.get(s) ?? 0} active={stage === s} onPress={() => setStage(s)} />
        ))}
      </ScrollView>
      {tags.length > 0 && (
        <View style={styles.tagFilter}>
          <TagFilter tags={tags} value={tag} onChange={setTag} />
        </View>
      )}

      <FlatList
        data={shown}
        keyExtractor={l => l.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="always"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="clientes" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {leads.length
                ? tag
                  ? t('Nenhum cliente com esta etiqueta nesta etapa.')
                  : t('Nenhum cliente nesta etapa.')
                : t('Cadastre seu primeiro cliente para acompanhar o funil de vendas.')}
            </Text>
          </View>
        }
        renderItem={({ item }) => <LeadRow lead={item} testID={`lead-${item.id}`} onPress={() => onOpen(item.id)} onTalk={() => onTalk(item)} />}
      />
    </View>
  );
}

/**
 * Cliente na lista (e nos resultados da busca): iniciais, nome, etapa, último
 * contato e etiquetas. "Conversar" abre a conversa no WhatsApp.
 */
function LeadRow({ lead, onPress, onTalk, testID }: { lead: CRMLead; onPress: () => void; onTalk: () => void; testID?: string }) {
  const styles = useStyles();
  const canTalk = !!whatsappLink(lead.phone);
  return (
    <Pressable testID={testID} style={({ pressed }) => [styles.leadCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(lead.clientName)}</Text>
      </View>
      <View style={[styles.flex, styles.leadBody]}>
        <Text style={styles.leadName} numberOfLines={1}>
          {lead.clientName}
        </Text>
        <Text style={styles.leadMeta} numberOfLines={1}>
          {t(lead.stage)} · {lastContactLabel(lead)}
        </Text>
        <TagList tags={lead.tags} max={3} />
      </View>
      {canTalk ? (
        <UseButton testID={testID && `${testID}-talk`} label={t('Conversar')} onPress={onTalk} />
      ) : (
        <Text style={styles.noPhone}>{t('Sem WhatsApp')}</Text>
      )}
    </Pressable>
  );
}

function StageTab({ label, count, active, index, onPress }: { label: string; count: number; active: boolean; index?: number; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.stageTab, active && styles.stageTabActive]} onPress={onPress}>
      <Text style={[styles.stageCount, active && styles.stageCountActive]}>{count}</Text>
      <Text style={[styles.stageLabel, active && styles.stageLabelActive]} numberOfLines={1}>
        {index ? `${index}. ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

// ── Ficha do cliente ────────────────────────────────────────────────────

function LeadDetail({
  segment,
  lead,
  stages,
  agenda,
  onBack,
  onEdit,
  onSave,
  onDelete,
  onInsert,
  onSchedule,
  onTalk,
  tags,
}: {
  segment: SegmentProfile;
  lead: CRMLead;
  stages: string[];
  agenda: ScheduleItem[];
  onBack: () => void;
  onEdit: () => void;
  onSave: (l: CRMLead) => void;
  onDelete: () => void;
  onInsert: (text: string) => void;
  onSchedule: () => void;
  onTalk: () => void;
  /** Etiquetas usadas nos clientes (para ligar/desligar na ficha). */
  tags: string[];
}) {
  const styles = useStyles();
  const link = whatsappLink(lead.phone);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = upcoming(agenda, 2);
  const touch = (changes: Partial<CRMLead>) => onSave({ ...lead, ...changes, lastContactAt: new Date().toISOString() });

  return (
    <View style={styles.flex}>
      <Header title={lead.clientName} onBack={onBack} actionLabel={t('Editar')} onAction={onEdit} secondary />
      <ScrollView contentContainerStyle={styles.detail} keyboardShouldPersistTaps="always">
        <View style={styles.detailHead}>
          <View style={[styles.avatar, styles.avatarLarge]}>
            <Text style={[styles.avatarText, styles.avatarTextLarge]}>{initials(lead.clientName)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.detailPhone}>{lead.phone || t('Sem telefone')}</Text>
            {link ? (
              <Text style={styles.link} numberOfLines={1}>
                {link.replace('https://', '')}
              </Text>
            ) : null}
            <Text style={styles.leadMeta}>{t('Último contato: {lastContactLabellead}', { lastContactLabellead: lastContactLabel(lead).toLowerCase() })}</Text>
          </View>
        </View>

        <Text style={styles.section}>{t('Etapa do funil')}</Text>
        <ChoiceRow
          options={stages.map(s => ({ value: s, label: t(s) }))}
          value={lead.stage}
          onChange={stage => onSave({ ...lead, stage })}
        />

        <Text style={styles.section}>{t('Etiquetas')}</Text>
        <TagPicker
          available={tags}
          selected={lead.tags ?? []}
          onToggle={tag => onSave({ ...lead, tags: toggleTag(lead.tags ?? [], tag) })}
          onNew={onEdit}
        />

        <Text style={styles.section}>{t('Ações')}</Text>
        <View style={styles.actions}>
          {link ? <Action testID="lead-talk" icon="compartilhar" label={t('Conversar no WhatsApp')} primary onPress={onTalk} /> : null}
          <Action
            icon="respostas"
            label={t('Enviar mensagem de retorno')}
            primary={!link}
            onPress={() => {
              touch({});
              onInsert(formatFollowUp(lead.clientName.split(/\s+/)[0], segment.id));
            }}
          />
          <Action icon="calendario" label={t('Agendar')} onPress={onSchedule} />
          <Action icon="check" label={t('Registrar contato')} onPress={() => touch({})} />
          {link ? <Action icon="adicionar" label={t('Inserir link do WhatsApp')} onPress={() => onInsert(link)} /> : null}
        </View>

        {next.length > 0 && (
          <>
            <Text style={styles.section}>{t('Próximos compromissos')}</Text>
            {next.map(a => (
              <View key={a.id} style={styles.agendaRow}>
                <Icon name="calendario" size={16} />
                <Text style={styles.agendaText} numberOfLines={1}>
                  {formatDayLong(a.date)}
                  {a.time ? ` · ${a.time}` : ''} — {a.title}
                </Text>
              </View>
            ))}
          </>
        )}

        {lead.notes ? (
          <>
            <Text style={styles.section}>{t('Anotações')}</Text>
            <Text style={styles.notes}>{lead.notes}</Text>
          </>
        ) : null}

        <Pressable style={styles.deleteBtn} onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
          <Text style={styles.deleteText}>{confirmDelete ? t('Toque de novo para excluir') : t('Excluir cliente')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, primary, onPress, testID }: { icon: IconName; label: string; primary?: boolean; onPress: () => void; testID?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, primary && styles.actionPrimary, pressed && styles.pressed]}
      onPress={onPress}>
      {primary && <CoralSheen radius={radius.md} />}
      <Icon name={icon} size={18} color={primary ? colors.onPrimary : colors.text} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Cadastro / edição ───────────────────────────────────────────────────

const LEAD_FIELDS: FormFieldSpec[] = [
  { key: 'name', label: 'Nome do cliente', placeholder: 'Toque e digite', kind: 'name' },
  { key: 'phone', label: 'WhatsApp do cliente', placeholder: 'Com DDD (opcional)', kind: 'phone' },
  { key: 'notes', label: 'Anotações', placeholder: 'Opcional: interesse, orçamento...' },
];

const NEW_TAG_FIELD: FormFieldSpec = { key: 'newTag', label: 'Nova etiqueta', placeholder: 'Ex: Quente, Indicação, VIP' };

function LeadForm({
  segment,
  lead,
  tags: available,
  onCancel,
  onSaved,
}: {
  segment: SegmentProfile;
  lead: CRMLead | null;
  /** Etiquetas usadas nos clientes. */
  tags: string[];
  onCancel: () => void;
  onSaved: (l: CRMLead) => void;
}) {
  const styles = useStyles();
  const [addingTag, setAddingTag] = useState(false);
  const fields = useMemo(() => (addingTag ? [...LEAD_FIELDS, NEW_TAG_FIELD] : LEAD_FIELDS), [addingTag]);
  const form = useKeyboardForm(fields, {
    name: lead?.clientName ?? '',
    phone: lead?.phone ?? '',
    notes: lead?.notes ?? '',
    newTag: '',
  });
  const [stage, setStage] = useState(lead?.stage ?? segment.crmStages[0]);
  const [tags, setTags] = useState<string[]>(lead?.tags ?? []);
  const name = form.values.name.trim();
  const link = whatsappLink(form.values.phone);
  const activeSpec = fields.find(f => f.key === form.active);

  // Abriu "Nova etiqueta": o teclado escreve nela
  useEffect(() => {
    if (addingTag) form.setActive('newTag');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addingTag]);

  /** Etiqueta digitada entra na lista do cliente (sem repetir). */
  const addTyped = (list: string[]) => {
    const typed = cleanTag(form.values.newTag ?? '');
    return typed && !list.some(x => x.toLowerCase() === typed.toLowerCase()) ? [...list, typed] : list;
  };

  const confirmTag = () => {
    setTags(addTyped);
    form.setValue('newTag', '');
    setAddingTag(false);
    form.setActive('name');
  };

  const save = () => {
    if (!name) return;
    const now = new Date().toISOString();
    const finalTags = addTyped(tags);
    onSaved({
      id: lead?.id ?? newLeadId(),
      clientName: name,
      phone: form.values.phone.trim(),
      notes: form.values.notes.trim() || undefined,
      stage,
      tags: finalTags.length ? finalTags : undefined,
      createdAt: lead?.createdAt ?? now,
      lastContactAt: lead?.lastContactAt ?? now,
    });
  };

  return (
    <View style={styles.flex}>
      <Header
        title={lead ? t('Editar cliente') : t('Novo cliente')}
        onBack={onCancel}
        actionLabel={t('Salvar')}
        onAction={save}
        disabled={!name}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
        {LEAD_FIELDS.map(f => (
          <React.Fragment key={f.key}>
            <KeyboardFormField spec={f} value={form.values[f.key] ?? ''} active={form.active === f.key} onPress={() => form.setActive(f.key)} />
            {/* O número vira o link da conversa */}
            {f.key === 'phone' && form.values.phone.trim() ? (
              <Text style={[styles.hint, !link && styles.hintError]}>
                {link ? t('Link da conversa: {link}', { link: link.replace('https://', '') }) : t('Número incompleto: inclua o DDD.')}
              </Text>
            ) : null}
          </React.Fragment>
        ))}
        <Text style={styles.section}>{t('Etapa')}</Text>
        <ChoiceRow options={segment.crmStages.map(s => ({ value: s, label: t(s) }))} value={stage} onChange={setStage} />

        <Text style={styles.section}>{t('Etiquetas')}</Text>
        <TagPicker available={available} selected={tags} onToggle={tag => setTags(list => toggleTag(list, tag))} onNew={addingTag ? undefined : () => setAddingTag(true)} />
        {addingTag && (
          <View style={styles.newTag}>
            <View style={styles.flex}>
              <KeyboardFormField
                spec={NEW_TAG_FIELD}
                value={form.values.newTag ?? ''}
                active={form.active === 'newTag'}
                onPress={() => form.setActive('newTag')}
              />
            </View>
            <ActionButton testID="tag-add" icon="check" label={t('Adicionar')} onPress={confirmTag} />
          </View>
        )}
      </ScrollView>
      <KeyboardFormKeys sink={form.sink} activeKey={form.active} spec={activeSpec} />
    </View>
  );
}

// ── Cabeçalho comum ─────────────────────────────────────────────────────

export function Header({
  title,
  count,
  onBack,
  actionLabel,
  onAction,
  secondary,
  disabled,
}: {
  title: string;
  count?: number;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Voltar')} hitSlop={8} style={styles.headerBack} onPress={onBack}>
        <Icon name="voltar" size={20} color={colors.textMuted} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {count !== undefined && <Text style={styles.headerCount}>{count}</Text>}
      </Pressable>
      {actionLabel && onAction ? (
        <Pressable
          testID={`header-action-${actionLabel}`}
          accessibilityRole="button"
          disabled={disabled}
          style={[styles.headerAction, !secondary && styles.headerActionPrimary, secondary && styles.headerActionSecondary, disabled && styles.disabled]}
          onPress={onAction}>
          {!secondary && <CoralSheen radius={radius.sm} />}
          {!secondary && actionLabel !== t('Salvar') && <Icon name="adicionar" size={16} color={colors.onPrimary} />}
          <Text style={[styles.headerActionText, !secondary && onCoralText, secondary && styles.headerActionTextSecondary]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
  },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text, flexShrink: 1 },
  headerCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryText,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    borderRadius: radius.sm,
  },
  headerActionPrimary: { ...coralGlass(colors, { pill: false }) },
  headerActionSecondary: { backgroundColor: colors.surface, ...glassBorder(colors) },
  headerActionText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  headerActionTextSecondary: { color: colors.text },
  // Sem isto a faixa horizontal estica e ocupa a tela toda
  funnelScroll: { flexGrow: 0, flexShrink: 0 },
  funnel: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  stageTab: {
    minWidth: 92,
    maxWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  stageTabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  stageCount: { fontSize: 18, fontWeight: '700', color: colors.text },
  stageCountActive: { color: colors.primaryText },
  stageLabel: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  stageLabelActive: { color: colors.primaryText, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  avatarTextLarge: { fontSize: 18 },
  leadName: { fontSize: 15, fontWeight: '600', color: colors.text },
  leadMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  leadBody: { gap: 3 },
  noPhone: { fontSize: 11, color: colors.textMuted },
  link: { fontSize: 12, color: colors.primaryText, marginTop: 1 },
  tagFilter: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -2, paddingHorizontal: spacing.xs },
  hintError: { color: colors.danger },
  newTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stagePill: {
    maxWidth: 120,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  stagePillText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  detail: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  detailPhone: { fontSize: 16, fontWeight: '600', color: colors.text },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  actionPrimary: { backgroundColor: colors.primary, justifyContent: 'center', ...coralGlass(colors, { pill: false }) },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.text },
  actionTextPrimary: { color: colors.onPrimary, ...onCoralText },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, ...glassBorder(colors), borderRadius: radius.sm, padding: spacing.sm },
  agendaText: { flex: 1, fontSize: 13, color: colors.text },
  notes: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, backgroundColor: colors.surface, ...glassBorder(colors), borderRadius: radius.sm, padding: spacing.md },
  deleteBtn: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.sm },
  deleteText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  form: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
}));
