/**
 * Atalhos no teclado: enviar ("Usar") e também gerenciar ali mesmo os
 * atalhos de texto, áudio e link — tocar no atalho abre a edição. Um menu pequeno filtra entre
 * os três tipos; a busca procura em todos.
 *
 * Áudio: grava pelo microfone ou escolhe um arquivo do celular. No teclado,
 * o pedido do microfone e o seletor de arquivos abrem por cima da conversa
 * (KeyboardBridge); a gravação para se o teclado fechar (o Android silencia o
 * microfone de quem não está na tela).
 *
 * As regras de salvar são as mesmas do app (src/shortcuts) e tudo grava no
 * mesmo armazenamento: o que muda aqui aparece no app e vice-versa.
 */
import { t } from '../../i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { cancelRecording, canRecord, startRecording, stopRecording } from '../../native/AudioRecorder';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { HeightMode } from '../../native/KeyboardBridge';
import { formatDuration } from '../../services/mediaUpload';
import type { LocalMedia } from '../../services/mediaUpload';
import { audioLink, deleteShortcut, linkMessage, saveAudioShortcut, saveLinkShortcut, saveTextShortcut } from '../../shortcuts/shortcuts';
import type { AudioDraft, ShortcutKind } from '../../shortcuts/shortcuts';
import type { AudioShortcut, LinkShortcut, SellerProfile, ShortcutsData, TextShortcut } from '../../types';
import { applyTemplate } from '../../utils/formatters';
import { UploadStatus, useUploader } from '../../app/components/MediaUpload';
import { makeStyles, radius, spacing, useColors } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { ItemCard } from './ItemCard';
import { ActionButton, BarButton, ConfirmDelete, UseButton } from './KeyboardButtons';
import { Header } from './KeyboardCRM';
import { KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';
import { MAX_RESULTS, NoResults, ResultsSection, SearchLauncher, SearchPanel, matches } from './KeyboardSearch';

interface Props {
  shortcuts: ShortcutsData;
  seller: SellerProfile;
  onInsert: (text: string) => void;
  /** Compartilhamento do Android; fallbackText é inserido se falhar. */
  onShare: (urls: string[], fallbackText: string) => void;
  /**
   * Tamanho do teclado: a lista abre um pouco mais alta (para ver mais
   * atalhos); busca e formulários em tela grande (o teclado de letras escreve neles).
   */
  onHeightChange: (mode: HeightMode) => void;
  /** Depois de gravar: relê os dados. */
  onChanged: () => void;
}

const FILTERS: Array<{ kind: ShortcutKind; label: string; icon: IconName }> = [
  { kind: 'text', label: 'Texto', icon: 'respostas' },
  { kind: 'audio', label: 'Áudio', icon: 'audio' },
  { kind: 'link', label: 'Link', icon: 'compartilhar' },
];

type Screen = { name: 'list' } | { name: 'search' } | { name: 'form'; kind: ShortcutKind; id: string | null };

export function ShortcutsTab({ shortcuts, seller, onInsert, onShare, onHeightChange, onChanged }: Props) {
  const styles = useStyles();
  const [filter, setFilter] = useState<ShortcutKind>('text');
  const [screen, setScreen] = useState<Screen>({ name: 'list' });

  const mode: HeightMode = screen.name === 'list' ? 'tall' : 'expanded';
  useEffect(() => {
    onHeightChange(mode);
    // O teclado volta ao tamanho normal sempre que fecha (ex.: o pedido do
    // microfone e o seletor de áudio o fecham): ao reabrir, pede o tamanho de novo
    return KeyboardBridge.onKeyboardShow(() => onHeightChange(mode));
  }, [mode, onHeightChange]);
  // Sair da aba: o teclado volta ao tamanho normal
  useEffect(() => () => onHeightChange('normal'), [onHeightChange]);

  const list = () => setScreen({ name: 'list' });
  const saved = () => {
    onChanged();
    list();
  };
  const sendText = (item: TextShortcut) => onInsert(applyTemplate(item.text, seller));
  const sendAudio = (item: AudioShortcut) => onShare([item.audioUrl], audioLink(item));
  const sendLink = (item: LinkShortcut) => onInsert(linkMessage(item));

  if (screen.name === 'form') {
    const { kind, id } = screen;
    const remove = () => {
      if (id) deleteShortcut(kind, id);
      saved();
    };
    if (kind === 'text') {
      return <TextForm item={shortcuts.texts.find(s => s.id === id) ?? null} onCancel={list} onSaved={saved} onDelete={remove} />;
    }
    if (kind === 'link') {
      return <LinkForm item={shortcuts.links.find(s => s.id === id) ?? null} onCancel={list} onSaved={saved} onDelete={remove} />;
    }
    return <AudioForm item={shortcuts.audios.find(s => s.id === id) ?? null} onCancel={list} onSaved={saved} onDelete={remove} />;
  }

  if (screen.name === 'search') {
    // Enviou um resultado: fecha a busca e o teclado volta ao tamanho normal
    const close = (send: () => void) => () => {
      list();
      send();
    };
    return (
      <SearchPanel testID="shortcuts-search" placeholder={t('Buscar atalhos')} onClose={list}>
        {query => {
          const texts = shortcuts.texts.filter(s => matches(query, s.title, s.text)).slice(0, MAX_RESULTS);
          const audios = shortcuts.audios.filter(a => matches(query, a.title, a.transcript)).slice(0, MAX_RESULTS);
          const links = shortcuts.links.filter(l => matches(query, l.title, l.url, l.message)).slice(0, MAX_RESULTS);
          if (!texts.length && !audios.length && !links.length) return <NoResults query={query} />;
          return (
            <>
              {texts.length > 0 && <ResultsSection title={t('Textos')} />}
              {texts.map(item => (
                <ItemCard
                  key={item.id}
                  testID={`search-shortcut-text-${item.id}`}
                  title={item.title}
                  subtitle={applyTemplate(item.text, seller)}
                  icon="respostas"
                  onPress={() => setScreen({ name: 'form', kind: 'text', id: item.id })}
                  trailing={<UseButton testID={`use-search-text-${item.id}`} onPress={close(() => sendText(item))} />}
                />
              ))}
              {audios.length > 0 && <ResultsSection title={t('Áudios')} />}
              {audios.map(item => (
                <ItemCard
                  key={item.id}
                  testID={`search-shortcut-audio-${item.id}`}
                  title={item.title}
                  subtitle={item.transcript ? `"${item.transcript}"` : undefined}
                  meta={item.duration || undefined}
                  icon="audio"
                  onPress={() => setScreen({ name: 'form', kind: 'audio', id: item.id })}
                  trailing={
                    <UseButton
                      testID={`use-search-audio-${item.id}`}
                      onPress={close(() => sendAudio(item))}
                      onLongPress={close(() => onInsert(audioLink(item)))}
                    />
                  }
                />
              ))}
              {links.length > 0 && <ResultsSection title={t('Links')} />}
              {links.map(item => (
                <ItemCard
                  key={item.id}
                  testID={`search-shortcut-link-${item.id}`}
                  title={item.title}
                  subtitle={item.url}
                  icon="compartilhar"
                  onPress={() => setScreen({ name: 'form', kind: 'link', id: item.id })}
                  trailing={<UseButton testID={`use-search-link-${item.id}`} onPress={close(() => sendLink(item))} />}
                />
              ))}
            </>
          );
        }}
      </SearchPanel>
    );
  }

  const counts: Record<ShortcutKind, number> = {
    text: shortcuts.texts.length,
    audio: shortcuts.audios.length,
    link: shortcuts.links.length,
  };
  const edit = (id: string) => setScreen({ name: 'form', kind: filter, id });

  return (
    <View style={styles.container} testID="shortcuts-tab">
      {/* Menu pequeno: Texto · Áudio · Link */}
      <View style={styles.filterBar} accessibilityRole="tablist">
        {FILTERS.map(f => {
          const active = filter === f.kind;
          return (
            <Pressable
              key={f.kind}
              testID={`shortcuts-filter-${f.kind}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              onPress={() => setFilter(f.kind)}>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]} numberOfLines={1}>
                {t(f.label)} ({counts[f.kind]})
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.toolbar}>
        <View style={styles.flex}>
          <SearchLauncher testID="shortcuts-search-open" placeholder={t('Buscar atalhos')} onPress={() => setScreen({ name: 'search' })} />
        </View>
        <BarButton
          testID="shortcuts-new"
          icon="adicionar"
          label={filter === 'text' ? t('Novo texto') : filter === 'audio' ? t('Novo áudio') : t('Novo link')}
          primary
          onPress={() => setScreen({ name: 'form', kind: filter, id: null })}
        />
      </View>

      {filter === 'text' && (
        <FlatList
          data={shortcuts.texts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={<Text style={styles.empty}>{t('Nenhum texto ainda. Toque em + para criar uma mensagem pronta.')}</Text>}
          renderItem={({ item }) => (
            <ItemCard
              testID={`shortcut-text-${item.id}`}
              icon="respostas"
              title={item.title}
              subtitle={applyTemplate(item.text, seller)}
              onPress={() => edit(item.id)}
              trailing={<UseButton testID={`use-text-${item.id}`} onPress={() => sendText(item)} />}
            />
          )}
        />
      )}
      {filter === 'audio' && (
        <FlatList
          data={shortcuts.audios}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={<Text style={styles.empty}>{t('Nenhum áudio ainda. Toque em + para gravar ou escolher um áudio do celular.')}</Text>}
          ListHeaderComponent={
            shortcuts.audios.length > 0 ? <Text style={styles.hint}>{t('Usar: envia o áudio • Segure o Usar: envia só o link')}</Text> : null
          }
          renderItem={({ item }) => (
            <ItemCard
              testID={`shortcut-audio-${item.id}`}
              icon="audio"
              title={item.title}
              subtitle={item.transcript ? `"${item.transcript}"` : undefined}
              meta={item.duration || undefined}
              onPress={() => edit(item.id)}
              trailing={<UseButton testID={`use-audio-${item.id}`} onPress={() => sendAudio(item)} onLongPress={() => onInsert(audioLink(item))} />}
            />
          )}
        />
      )}
      {filter === 'link' && (
        <FlatList
          data={shortcuts.links}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={<Text style={styles.empty}>{t('Nenhum link ainda. Toque em + para salvar um link de envio rápido.')}</Text>}
          renderItem={({ item }) => (
            <ItemCard
              testID={`shortcut-link-${item.id}`}
              icon="compartilhar"
              title={item.title}
              subtitle={item.message ? `${item.message} ${item.url}` : item.url}
              onPress={() => edit(item.id)}
              trailing={<UseButton testID={`use-link-${item.id}`} onPress={() => sendLink(item)} />}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Formulários ─────────────────────────────────────────────────────────

interface FormProps<T> {
  item: T | null;
  onCancel: () => void;
  onSaved: () => void;
  onDelete: () => void;
}

/** Cabeçalho, mensagem de erro, campos, "Excluir" (na edição) e o teclado de letras. */
function FormShell({
  title,
  editing,
  error,
  saveDisabled,
  onCancel,
  onSave,
  onDelete,
  deleteMessage,
  keys,
  children,
}: {
  title: string;
  editing: boolean;
  error: string | null;
  saveDisabled?: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  deleteMessage: string;
  keys: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.flex}>
      <Header title={title} onBack={onCancel} actionLabel={t('Salvar')} onAction={onSave} disabled={saveDisabled} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="always">
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Icon name="info" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {children}
        {editing &&
          (confirming ? (
            <ConfirmDelete testID="shortcut-delete-confirm" message={deleteMessage} onCancel={() => setConfirming(false)} onConfirm={onDelete} />
          ) : (
            <ActionButton testID="shortcut-delete" icon="lixeira" label={t('Excluir atalho')} onPress={() => setConfirming(true)} />
          ))}
      </ScrollView>
      {keys}
    </View>
  );
}

const TEXT_FIELDS: FormFieldSpec[] = [
  { key: 'title', label: 'Título', placeholder: 'Ex: Formas de pagamento' },
  { key: 'text', label: 'Mensagem', placeholder: 'Toque e digite', kind: 'multiline' },
];

function TextForm({ item, onCancel, onSaved, onDelete }: FormProps<TextShortcut>) {
  const styles = useStyles();
  const form = useKeyboardForm(TEXT_FIELDS, { title: item?.title ?? '', text: item?.text ?? '' });
  const [error, setError] = useState<string | null>(null);
  const active = TEXT_FIELDS.find(f => f.key === form.active);
  return (
    <FormShell
      title={item ? t('Editar texto') : t('Novo texto')}
      editing={!!item}
      error={error}
      onCancel={onCancel}
      onSave={() => {
        const r = saveTextShortcut(item?.id ?? null, form.values.title ?? '', form.values.text ?? '');
        if (r.ok) onSaved();
        else setError(r.error);
      }}
      onDelete={onDelete}
      deleteMessage={t('Excluir "{name}" do app e do teclado?', { name: item?.title ?? '' })}
      keys={<KeyboardFormKeys sink={form.sink} activeKey={form.active} spec={active} />}>
      {TEXT_FIELDS.map(f => (
        <KeyboardFormField key={f.key} spec={f} value={form.values[f.key] ?? ''} active={form.active === f.key} onPress={() => form.setActive(f.key)} />
      ))}
      <Text style={styles.hint}>{t('Variáveis: {{nome}}, {{empresa}} e {{telefone}} são trocadas pelos dados do seu perfil.')}</Text>
    </FormShell>
  );
}

const LINK_FIELDS: FormFieldSpec[] = [
  { key: 'title', label: 'Título', placeholder: 'Ex: Catálogo, Agendar horário' },
  { key: 'url', label: 'Link', placeholder: 'https://', kind: 'url' },
  { key: 'message', label: 'Mensagem antes do link (opcional)', placeholder: 'Ex: Veja nosso catálogo:', kind: 'multiline' },
];

function LinkForm({ item, onCancel, onSaved, onDelete }: FormProps<LinkShortcut>) {
  const form = useKeyboardForm(LINK_FIELDS, { title: item?.title ?? '', url: item?.url ?? '', message: item?.message ?? '' });
  const [error, setError] = useState<string | null>(null);
  const active = LINK_FIELDS.find(f => f.key === form.active);
  return (
    <FormShell
      title={item ? t('Editar link') : t('Novo link')}
      editing={!!item}
      error={error}
      onCancel={onCancel}
      onSave={() => {
        const r = saveLinkShortcut(item?.id ?? null, form.values.title ?? '', form.values.url ?? '', form.values.message ?? '');
        if (r.ok) onSaved();
        else setError(r.error);
      }}
      onDelete={onDelete}
      deleteMessage={t('Excluir "{name}" do app e do teclado?', { name: item?.title ?? '' })}
      keys={<KeyboardFormKeys sink={form.sink} activeKey={form.active} spec={active} />}>
      {LINK_FIELDS.map(f => (
        <KeyboardFormField key={f.key} spec={f} value={form.values[f.key] ?? ''} active={form.active === f.key} onPress={() => form.setActive(f.key)} />
      ))}
    </FormShell>
  );
}

const AUDIO_FIELDS: FormFieldSpec[] = [{ key: 'title', label: 'Título', placeholder: 'Ex: Boas-vindas, Explicação do serviço' }];

function AudioForm({ item, onCancel, onSaved, onDelete }: FormProps<AudioShortcut>) {
  const colors = useColors();
  const styles = useStyles();
  const form = useKeyboardForm(AUDIO_FIELDS, { title: item?.title ?? '' });
  const [audio, setAudio] = useState<AudioDraft | null>(
    item ? { audioUrl: item.audioUrl, storagePath: item.storagePath, duration: item.duration } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const uploader = useUploader();
  const recording = recordingSince !== null;
  const recordingRef = useRef(false);
  recordingRef.current = recording;

  // Relógio da gravação
  useEffect(() => {
    if (recordingSince === null) return;
    const timer = setInterval(() => setElapsed(Date.now() - recordingSince), 250);
    return () => clearInterval(timer);
  }, [recordingSince]);

  const stopAndDiscard = useCallback((message?: string) => {
    if (!recordingRef.current) return;
    cancelRecording();
    setRecordingSince(null);
    if (message) setError(message);
  }, []);

  // O teclado fechou gravando: o Android deixa o microfone mudo, então a gravação para
  useEffect(
    () =>
      KeyboardBridge.onKeyboardHide(() => {
        if (!KeyboardBridge.isPickingMedia()) stopAndDiscard(t('A gravação parou porque o teclado fechou. Grave de novo.'));
      }),
    [stopAndDiscard],
  );
  // Saiu do formulário gravando
  useEffect(() => () => stopAndDiscard(), [stopAndDiscard]);

  const keep = (media: LocalMedia) => (uploaded: { url: string; storagePath: string }) =>
    setAudio({ audioUrl: uploaded.url, storagePath: uploaded.storagePath, duration: formatDuration(media.durationMs) });

  const record = async () => {
    setError(null);
    try {
      await startRecording({ fromKeyboard: true });
      setElapsed(0);
      setRecordingSince(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não foi possível usar o microfone.'));
    }
  };

  const stop = async () => {
    setRecordingSince(null);
    let media: LocalMedia;
    try {
      media = await stopRecording();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não foi possível terminar a gravação.'));
      return;
    }
    uploader.run(async () => media, (uploaded, local) => keep(local)(uploaded));
  };

  const pickFile = () => {
    setError(null);
    uploader.run(
      () => KeyboardBridge.pickMedia('audio'),
      (uploaded, local) => keep(local)(uploaded),
    );
  };

  return (
    <FormShell
      title={item ? t('Editar áudio') : t('Novo áudio')}
      editing={!!item}
      error={error}
      saveDisabled={recording || !!uploader.uploading}
      onCancel={onCancel}
      onSave={() => {
        const r = saveAudioShortcut(item, form.values.title ?? '', audio);
        if (r.ok) onSaved();
        else setError(r.error);
      }}
      onDelete={onDelete}
      deleteMessage={t('Excluir "{name}" do app e do teclado?', { name: item?.title ?? '' })}
      keys={<KeyboardFormKeys sink={form.sink} activeKey={form.active} spec={AUDIO_FIELDS[0]} />}>
      <KeyboardFormField spec={AUDIO_FIELDS[0]} value={form.values.title ?? ''} active onPress={() => form.setActive('title')} />

      <Text style={styles.section}>{t('Áudio')}</Text>
      {recording ? (
        <View style={styles.recording} accessibilityLiveRegion="polite">
          <View style={styles.recStatus}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{formatDuration(elapsed) || '0:00'}</Text>
            <Text style={styles.recLabel}>{t('Gravando...')}</Text>
          </View>
          <View style={styles.rowGap}>
            <ActionButton testID="audio-record-cancel" icon="fechar" label={t('Cancelar')} onPress={() => stopAndDiscard()} />
            <ActionButton testID="audio-record-stop" icon="check" label={t('Parar')} onPress={stop} />
          </View>
        </View>
      ) : (
        <>
          {audio ? (
            <View style={styles.audioReady} testID="audio-ready">
              <Icon name="audio" size={20} color={colors.successText} />
              <Text style={styles.audioReadyText}>
                {audio.duration ? t('Áudio pronto ({duration})', { duration: audio.duration }) : t('Áudio pronto')}
              </Text>
            </View>
          ) : null}
          <View style={styles.rowGap}>
            {canRecord && (
              <ActionButton
                testID="audio-record"
                icon="audio"
                label={audio ? t('Gravar de novo') : t('Gravar')}
                disabled={!!uploader.uploading}
                onPress={record}
              />
            )}
            <ActionButton testID="audio-file" icon="arquivos" label={t('Do celular')} disabled={!!uploader.uploading} onPress={pickFile} />
          </View>
        </>
      )}
      <UploadStatus uploading={uploader.uploading} error={uploader.error} />
    </FormShell>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  filterBtn: {
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  filterBtnActive: { backgroundColor: colors.primarySoft },
  filterLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  filterLabelActive: { color: colors.primaryText, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.sm },
  list: { padding: spacing.sm, paddingTop: spacing.xs },
  rowGap: { flexDirection: 'row', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  form: { padding: spacing.sm, gap: spacing.sm },
  section: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.dangerBg },
  errorText: { flex: 1, fontSize: 13, color: colors.danger },
  recording: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
  },
  recStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recTime: { fontSize: 15, fontWeight: '700', color: colors.text },
  recLabel: { fontSize: 13, color: colors.textSecondary },
  audioReady: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  audioReadyText: { fontSize: 14, fontWeight: '600', color: colors.successText },
}));
