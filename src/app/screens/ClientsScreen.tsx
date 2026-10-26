import { t } from '../../i18n';
/**
 * Clientes (CRM) no app — mesmos dados do CRM do teclado.
 * Tela principal: busca, funil por etapa, etiquetas e lista; ficha e cadastro
 * em submenus. "Conversar" abre a conversa do cliente no WhatsApp (wa.me).
 */
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  tagCount,
  toggleTag,
  whatsappLink,
} from '../../crm/crm';
import { getSegment } from '../../segments/segments';
import { Repo } from '../../storage/storage';
import type { CRMLead } from '../../types';
import { Icon } from '../../keyboard/components/Icon';
import { ChoiceRow } from '../../keyboard/components/KeyboardForm';
import { UseButton } from '../../keyboard/components/KeyboardButtons';
import { TagChip, TagFilter, TagList, TagPicker } from '../../keyboard/components/TagChips';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { CoralSheen, Button, Card, CardText, CardTitle, EmptyState, Page, ScreenTitle, SubHeader } from '../components/ui';
import { useStoredList } from '../hooks/useStoredList';

interface Props {
  /** "Agendar" na ficha: abre a Agenda com o cliente. */
  onSchedule: (lead: CRMLead) => void;
}

type Section = { name: 'list' } | { name: 'tags' } | { name: 'detail'; id: string } | { name: 'form'; id: string | null };

export function ClientsScreen({ onSchedule }: Props) {
  const [leads, reload] = useStoredList(Repo.getCRM);
  const [section, setSection] = useState<Section>({ name: 'list' });
  const segment = getSegment(Repo.getSegment());

  const save = (lead: CRMLead) => {
    Repo.saveLead(lead);
    reload();
  };

  /** "Conversar": abre o WhatsApp na conversa do cliente e registra o contato de hoje. */
  const talk = (lead: CRMLead) => {
    const link = whatsappLink(lead.phone);
    if (!link) return;
    Linking.openURL(link).catch(() => Alert.alert(t('Atenção'), t('Não foi possível abrir o WhatsApp.')));
    save({ ...lead, lastContactAt: new Date().toISOString() });
  };
  const tags = allTags(leads, Repo.getCrmTags());

  if (section.name === 'tags') {
    return (
      <TagsSection
        leads={leads}
        onBack={() => setSection({ name: 'list' })}
        onChanged={reload}
      />
    );
  }

  if (section.name === 'form') {
    const lead = section.id ? leads.find(l => l.id === section.id) ?? null : null;
    return (
      <LeadForm
        lead={lead}
        stages={segment.crmStages}
        tags={tags}
        onBack={() => setSection(lead ? { name: 'detail', id: lead.id } : { name: 'list' })}
        onSave={l => {
          save(l);
          setSection({ name: 'detail', id: l.id });
        }}
      />
    );
  }

  if (section.name === 'detail') {
    const lead = leads.find(l => l.id === section.id);
    if (lead) {
      return (
        <LeadDetail
          lead={lead}
          stages={stagesFor(segment, leads)}
          onBack={() => setSection({ name: 'list' })}
          onEdit={() => setSection({ name: 'form', id: lead.id })}
          onSave={save}
          onSchedule={() => onSchedule(lead)}
          onTalk={() => talk(lead)}
          tags={tags}
          onDelete={() =>
            Alert.alert(t('Excluir cliente'), t('Deseja excluir "{clientName}"? Os compromissos dele continuam na agenda.', { clientName: lead.clientName }), [
              { text: t('Cancelar'), style: 'cancel' },
              {
                text: t('Excluir'),
                style: 'destructive',
                onPress: () => {
                  Repo.deleteLead(lead.id);
                  reload();
                  setSection({ name: 'list' });
                },
              },
            ])
          }
        />
      );
    }
  }

  return (
    <LeadList
      leads={leads}
      stages={stagesFor(segment, leads)}
      onOpen={id => setSection({ name: 'detail', id })}
      onNew={() => setSection({ name: 'form', id: null })}
      onTags={() => setSection({ name: 'tags' })}
      onTalk={talk}
    />
  );
}

function LeadList({
  leads,
  stages,
  onOpen,
  onNew,
  onTags,
  onTalk,
}: {
  leads: CRMLead[];
  stages: string[];
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Criar e organizar etiquetas. */
  onTags: () => void;
  onTalk: (lead: CRMLead) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [stage, setStage] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const counts = countByStage(leads);
  const tags = allTags(leads, Repo.getCrmTags());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return sortLeads(leads).filter(
      l =>
        (!stage || l.stage === stage) &&
        (!tag || hasTag(l, tag)) &&
        (!q ||
          l.clientName.toLowerCase().includes(q) ||
          (l.tags ?? []).some(x => x.toLowerCase().includes(q)) ||
          (digits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(digits))),
    );
  }, [leads, stage, tag, query]);

  if (!leads.length) {
    return (
      <Page>
        <ScreenTitle title={t('Clientes')} />
        <EmptyState
          icon="clientes"
          title={t('Nenhum cliente ainda')}
          text={t('Cadastre aqui ou direto no teclado (botão CRM), durante a conversa.')}
          actionLabel={t('Novo cliente')}
          onAction={onNew}
        />
        <Button testID="clients-tags" label={t('Criar etiqueta')} icon="etiquetas" variant="secondary" onPress={onTags} />
      </Page>
    );
  }

  return (
    <Page>
      <View style={styles.titleRow}>
        <ScreenTitle title={t('Clientes')} subtitle={t('{length} no funil', { length: leads.length })} />
        <View style={styles.titleActions}>
          {/* Nova etiqueta, ao lado do "+ Novo" */}
          <Pressable
            testID="clients-tags"
            accessibilityRole="button"
            accessibilityLabel={t('Criar etiqueta')}
            style={({ pressed }) => [styles.tagBtn, pressed && styles.pressed]}
            onPress={onTags}>
            <Icon name="etiquetas" size={18} color={colors.text} />
            <Text style={styles.tagBtnText}>{t('Etiqueta')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.addBtn} onPress={onNew}>
            <CoralSheen />
            <Icon name="adicionar" size={18} color={colors.onPrimary} />
            <Text style={styles.addBtnText}>{t('Novo')}</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder={t('Buscar por nome, telefone ou etiqueta')}
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
      />

      {/* Funil: quantidade por etapa (toque para filtrar) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.funnel}>
        {[null, ...stages].map((s, i) => {
          const active = stage === s;
          return (
            <Pressable
              key={s ?? 'all'}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.stage, active && styles.stageActive]}
              onPress={() => setStage(s)}>
              <Text style={[styles.stageCount, active && styles.stageTextActive]}>{s ? counts.get(s) ?? 0 : leads.length}</Text>
              <Text style={[styles.stageLabel, active && styles.stageTextActive]} numberOfLines={1}>
                {s ? `${i}. ${t(s)}` : t('Todos')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TagFilter tags={tags} value={tag} onChange={setTag} />

      <View style={styles.list}>
        {shown.length === 0 && <CardText>{t('Nenhum cliente encontrado.')}</CardText>}
        {shown.map(l => (
          <Pressable key={l.id} testID={`lead-${l.id}`} style={({ pressed }) => [styles.leadCard, pressed && styles.pressed]} onPress={() => onOpen(l.id)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(l.clientName)}</Text>
            </View>
            <View style={[styles.flex, styles.leadBody]}>
              <Text style={styles.leadName} numberOfLines={1}>
                {l.clientName}
              </Text>
              <Text style={styles.leadMeta} numberOfLines={1}>
                {t(l.stage)} · {lastContactLabel(l)}
              </Text>
              <TagList tags={l.tags} max={3} />
            </View>
            {whatsappLink(l.phone) ? (
              <UseButton testID={`lead-${l.id}-talk`} label={t('Conversar')} onPress={() => onTalk(l)} />
            ) : (
              <Icon name="avancar" size={18} color={colors.textMuted} />
            )}
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

/** Etiquetas: criar uma nova (antes de usar em algum cliente) e excluir as que não servem mais. */
function TagsSection({ leads, onBack, onChanged }: { leads: CRMLead[]; onBack: () => void; onChanged: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [name, setName] = useState('');
  // Relê a lista a cada mudança (criar ou excluir)
  const [, setVersion] = useState(0);
  const tags = allTags(leads, Repo.getCrmTags());

  const create = () => {
    const tag = cleanTag(name);
    if (!tag) {
      Alert.alert(t('Atenção'), t('Informe o nome da etiqueta.'));
      return;
    }
    if (tags.some(x => x.toLowerCase() === tag.toLowerCase())) {
      Alert.alert(t('Atenção'), t('Essa etiqueta já existe.'));
      return;
    }
    Repo.addCrmTag(tag);
    setName('');
    setVersion(v => v + 1);
    onChanged();
  };

  const remove = (tag: string) => {
    const n = tagCount(leads, tag);
    Alert.alert(
      t('Excluir etiqueta'),
      n
        ? t('Excluir "{tag}"? Ela sai dos {n} clientes que a usam.', { tag, n })
        : t('Excluir "{tag}"?', { tag }),
      [
        { text: t('Cancelar'), style: 'cancel' },
        {
          text: t('Excluir'),
          style: 'destructive',
          onPress: () => {
            Repo.deleteCrmTag(tag);
            setVersion(v => v + 1);
            onChanged();
          },
        },
      ],
    );
  };

  return (
    <Page>
      <SubHeader title={t('Etiquetas')} onBack={onBack} />
      <Card>
        <CardTitle>{t('Nova etiqueta')}</CardTitle>
        <CardText>{t('Use etiquetas para separar os clientes ("Quente", "Indicação", "VIP") e filtrar a lista. Elas aparecem também no CRM do teclado.')}</CardText>
        <TextInput
          testID="tag-name-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('Ex: Quente, Indicação, VIP')}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={create}
          returnKeyType="done"
        />
        <Button testID="tag-create" label={t('Criar etiqueta')} icon="adicionar" onPress={create} />
      </Card>

      {tags.length > 0 ? (
        <Card>
          <CardTitle>{t('Suas etiquetas')}</CardTitle>
          {tags.map(tag => {
            const n = tagCount(leads, tag);
            return (
              <View key={tag} style={styles.tagRow}>
                <TagChip tag={tag} />
                <Text style={styles.tagCount}>{n === 1 ? t('1 cliente') : t('{n} clientes', { n })}</Text>
                <Pressable testID={`tag-delete-${tag}`} accessibilityRole="button" accessibilityLabel={t('Excluir etiqueta')} hitSlop={8} onPress={() => remove(tag)}>
                  <Icon name="lixeira" size={18} color={colors.danger} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Page>
  );
}

function LeadDetail({
  lead,
  stages,
  onBack,
  onEdit,
  onSave,
  onSchedule,
  onDelete,
  onTalk,
  tags,
}: {
  lead: CRMLead;
  stages: string[];
  onBack: () => void;
  onEdit: () => void;
  onSave: (l: CRMLead) => void;
  onSchedule: () => void;
  onDelete: () => void;
  onTalk: () => void;
  /** Etiquetas usadas nos clientes (para ligar/desligar na ficha). */
  tags: string[];
}) {
  const styles = useStyles();
  const link = whatsappLink(lead.phone);
  const next = upcoming(Repo.getAgenda().filter(a => a.clientId === lead.id), 3);
  return (
    <Page>
      <SubHeader title={t('Clientes')} onBack={onBack} />
      <Card style={styles.profile}>
        <View style={[styles.avatar, styles.avatarLarge]}>
          <Text style={[styles.avatarText, styles.avatarTextLarge]}>{initials(lead.clientName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.profileName}>{lead.clientName}</Text>
          <Text style={styles.leadMeta}>{lead.phone || t('Sem telefone')}</Text>
          {link ? (
            <Text style={styles.link} numberOfLines={1}>
              {link.replace('https://', '')}
            </Text>
          ) : null}
          <Text style={styles.leadMeta}>{t('Último contato: {lastContactLabellead}', { lastContactLabellead: lastContactLabel(lead).toLowerCase() })}</Text>
        </View>
      </Card>

      {link ? <Button testID="lead-talk" label={t('Conversar no WhatsApp')} icon="compartilhar" onPress={onTalk} /> : null}

      <Card>
        <CardTitle>{t('Etiquetas')}</CardTitle>
        <TagPicker
          available={tags}
          selected={lead.tags ?? []}
          onToggle={tag => onSave({ ...lead, tags: toggleTag(lead.tags ?? [], tag) })}
          onNew={onEdit}
        />
      </Card>

      <Card>
        <CardTitle>{t('Etapa do funil')}</CardTitle>
        <ChoiceRow onCard options={stages.map(s => ({ value: s, label: t(s) }))} value={lead.stage} onChange={stage => onSave({ ...lead, stage })} />
      </Card>

      <Card>
        <CardTitle>{t('Próximos compromissos')}</CardTitle>
        {next.length ? (
          next.map(a => (
            <Text key={a.id} style={styles.agendaLine}>
              {formatDayLong(a.date)}
              {a.time ? ` · ${a.time}` : ''} — {a.title}
            </Text>
          ))
        ) : (
          <CardText>{t('Nada agendado com este cliente.')}</CardText>
        )}
        <Button label={t('Agendar')} variant="secondary" icon="calendario" onPress={onSchedule} />
      </Card>

      {lead.notes ? (
        <Card>
          <CardTitle>{t('Anotações')}</CardTitle>
          <CardText>{lead.notes}</CardText>
        </Card>
      ) : null}

      <Button
        label={t('Registrar contato agora')}
        icon="check"
        variant={link ? 'secondary' : 'primary'}
        onPress={() => onSave({ ...lead, lastContactAt: new Date().toISOString() })}
      />
      <Button label={t('Editar')} variant="secondary" onPress={onEdit} />
      <Button label={t('Excluir cliente')} variant="danger" onPress={onDelete} />
    </Page>
  );
}

function LeadForm({
  lead,
  stages,
  tags: available,
  onBack,
  onSave,
}: {
  lead: CRMLead | null;
  stages: string[];
  /** Etiquetas usadas nos clientes. */
  tags: string[];
  onBack: () => void;
  onSave: (l: CRMLead) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [name, setName] = useState(lead?.clientName ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [stage, setStage] = useState(lead?.stage ?? stages[0]);
  const [tags, setTags] = useState<string[]>(lead?.tags ?? []);
  const [newTag, setNewTag] = useState<string | null>(null);
  const link = whatsappLink(phone);

  /** Etiqueta digitada entra na lista do cliente (sem repetir). */
  const withTyped = (list: string[]) => {
    const typed = cleanTag(newTag ?? '');
    return typed && !list.some(x => x.toLowerCase() === typed.toLowerCase()) ? [...list, typed] : list;
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('Atenção'), t('Informe o nome do cliente.'));
      return;
    }
    const now = new Date().toISOString();
    onSave({
      id: lead?.id ?? newLeadId(),
      clientName: name.trim(),
      phone: phone.trim(),
      notes: notes.trim() || undefined,
      stage,
      tags: withTyped(tags).length ? withTyped(tags) : undefined,
      createdAt: lead?.createdAt ?? now,
      lastContactAt: lead?.lastContactAt ?? now,
    });
  };

  const input = (label: string, value: string, onChange: (v: string) => void, placeholder: string, extra: object = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} {...extra} />
    </View>
  );

  return (
    <Page>
      <SubHeader title={lead ? t('Editar cliente') : t('Novo cliente')} onBack={onBack} />
      <Card>
        {input(t('Nome'), name, setName, t('Nome do cliente'))}
        {input(t('WhatsApp do cliente'), phone, setPhone, t('Com DDD (opcional)'), { keyboardType: 'phone-pad', testID: 'lead-phone' })}
        {/* O número vira o link da conversa */}
        {phone.trim() ? (
          <Text style={[styles.hint, !link && styles.hintError]}>
            {link ? t('Link da conversa: {link}', { link: link.replace('https://', '') }) : t('Número incompleto: inclua o DDD.')}
          </Text>
        ) : null}
        {input(t('Anotações'), notes, setNotes, t('Interesse, orçamento, preferências...'), { multiline: true, style: [styles.input, styles.textArea] })}
      </Card>
      <Card>
        <CardTitle>{t('Etapa')}</CardTitle>
        <ChoiceRow onCard options={stages.map(s => ({ value: s, label: t(s) }))} value={stage} onChange={setStage} />
      </Card>
      <Card>
        <CardTitle>{t('Etiquetas')}</CardTitle>
        <TagPicker
          available={available}
          selected={tags}
          onToggle={tag => setTags(list => toggleTag(list, tag))}
          onNew={newTag === null ? () => setNewTag('') : undefined}
        />
        {newTag !== null && (
          <View style={styles.newTag}>
            <TextInput
              testID="lead-new-tag"
              style={[styles.input, styles.flex]}
              autoFocus
              value={newTag}
              onChangeText={setNewTag}
              placeholder={t('Ex: Quente, Indicação, VIP')}
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => {
                setTags(withTyped);
                setNewTag(null);
              }}
              returnKeyType="done"
            />
            <Button
              label={t('Adicionar')}
              variant="secondary"
              onPress={() => {
                setTags(withTyped);
                setNewTag(null);
              }}
            />
          </View>
        )}
      </Card>
      <Button label={t('Salvar')} onPress={save} />
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  titleActions: { flexDirection: 'row', gap: spacing.sm },
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  tagBtnText: { color: colors.text, ...typography.button },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 40 },
  tagCount: { flex: 1, fontSize: 13, color: colors.textMuted },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    borderRadius: radius.md,
    ...coralGlass(colors),
  },
  addBtnText: { color: colors.onPrimary, ...typography.button, ...onCoralText },
  search: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  funnel: { gap: spacing.sm },
  stage: {
    minWidth: 96,
    maxWidth: 160,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  stageActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  stageCount: { fontSize: 22, fontWeight: '700', color: colors.text },
  stageLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stageTextActive: { color: colors.primaryText },
  list: { gap: spacing.sm },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.primaryText },
  avatarTextLarge: { fontSize: 19 },
  leadName: { fontSize: 15, fontWeight: '600', color: colors.text },
  leadMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  profile: { flexDirection: 'row', alignItems: 'center' },
  profileName: { ...typography.title, color: colors.text },
  agendaLine: { fontSize: 14, color: colors.text },
  leadBody: { gap: 3 },
  link: { fontSize: 13, color: colors.primaryText, marginTop: 2 },
  hint: { fontSize: 12, color: colors.textMuted },
  hintError: { color: colors.danger },
  newTag: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  textArea: { minHeight: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
}));
