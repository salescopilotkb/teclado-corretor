import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Repo } from '../../storage/storage';
import type { AudioShortcut, LinkShortcut, ShortcutsData, TextShortcut } from '../../types';
import { deleteShortcut, saveLinkShortcut } from '../../shortcuts/shortcuts';
import { normalizeUrl } from '../../utils/formatters';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { Icon, IconTile } from '../../keyboard/components/Icon';
import { CoralSheen, EmptyState } from '../components/ui';
import { SourceButtons, UploadStatus, useUploader } from '../components/MediaUpload';
import { canRecord, cancelRecording, RecorderError, startRecording, stopRecording } from '../../native/AudioRecorder';
import { pickAudioFile } from '../../native/MediaPicker';
import { deleteUploadedMedia, formatDuration } from '../../services/mediaUpload';
import type { LocalMedia } from '../../services/mediaUpload';
import { t } from '../../i18n';

/** Formulários de criação/edição: id null = criando um atalho novo. */
interface TextForm {
  id: string | null;
  title: string;
  text: string;
}

interface AudioForm {
  id: string | null;
  title: string;
  url: string;
  duration: string;
  transcript: string;
  /** Áudio gravado ou enviado pelo app (vazio = link colado). */
  storagePath?: string;
  /** Mostrar o campo de link (em vez dos botões de gravar/arquivo). */
  linkMode?: boolean;
}

const EMPTY_AUDIO_FORM: AudioForm = { id: null, title: '', url: '', duration: '', transcript: '' };

interface LinkForm {
  id: string | null;
  title: string;
  url: string;
  message: string;
}

const EMPTY_LINK_FORM: LinkForm = { id: null, title: '', url: '', message: '' };

type ShortcutTab = 'text' | 'audio' | 'link';

function confirmDelete(title: string, onConfirm: () => void) {
  Alert.alert(t('Excluir atalho'), t('Deseja excluir "{title}"?', { title }), [
    { text: t('Cancelar'), style: 'cancel' },
    { text: t('Excluir'), style: 'destructive', onPress: onConfirm },
  ]);
}

export function ShortcutsManagerScreen() {
  const colors = useColors();
  const styles = useStyles();
  const [shortcuts, setShortcuts] = useState<ShortcutsData>(() => Repo.getShortcuts());
  const [activeTab, setActiveTab] = useState<ShortcutTab>('text');
  const [linkForm, setLinkForm] = useState<LinkForm | null>(null);

  const [textForm, setTextForm] = useState<TextForm | null>(null);
  const [audioForm, setAudioForm] = useState<AudioForm | null>(null);

  // Gravação e envio do áudio
  const uploader = useUploader();
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  /** Arquivo enviado neste formulário e ainda não salvo (apagado se cancelar). */
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);

  useEffect(() => {
    if (recordingSince === null) return;
    const timer = setInterval(() => setElapsed(Date.now() - recordingSince), 250);
    return () => clearInterval(timer);
  }, [recordingSince]);

  // Saiu da tela no meio da gravação: descarta
  useEffect(() => () => {
    cancelRecording();
  }, []);

  const applyRecordedAudio = (local: LocalMedia) => {
    uploader.run(
      () => Promise.resolve(local),
      uploaded => {
        if (pendingUpload) deleteUploadedMedia(pendingUpload);
        setPendingUpload(uploaded.storagePath);
        setAudioForm(f =>
          f && {
            ...f,
            url: uploaded.url,
            storagePath: uploaded.storagePath,
            duration: formatDuration(local.durationMs) || f.duration,
            linkMode: false,
          },
        );
      },
    );
  };

  const handleStartRecording = async () => {
    setRecordError(null);
    uploader.clearError();
    try {
      await startRecording();
      setElapsed(0);
      setRecordingSince(Date.now());
    } catch (e) {
      setRecordError(e instanceof RecorderError ? e.message : t('Não foi possível usar o microfone.'));
    }
  };

  const handleStopRecording = async () => {
    setRecordingSince(null);
    try {
      applyRecordedAudio(await stopRecording());
    } catch (e) {
      setRecordError(e instanceof RecorderError ? e.message : t('Não foi possível terminar a gravação.'));
    }
  };

  const handleCancelRecording = () => {
    setRecordingSince(null);
    cancelRecording();
  };

  const handlePickAudioFile = () => {
    setRecordError(null);
    uploader.run(pickAudioFile, (uploaded, local) => {
      if (pendingUpload) deleteUploadedMedia(pendingUpload);
      setPendingUpload(uploaded.storagePath);
      setAudioForm(f =>
        f && { ...f, url: uploaded.url, storagePath: uploaded.storagePath, duration: formatDuration(local.durationMs) || f.duration, linkMode: false },
      );
    });
  };

  /** Fecha o formulário de áudio; o que foi enviado e não salvo sai da nuvem. */
  const closeAudioForm = () => {
    if (recordingSince !== null) handleCancelRecording();
    if (pendingUpload) deleteUploadedMedia(pendingUpload);
    setPendingUpload(null);
    setRecordError(null);
    uploader.clearError();
    setAudioForm(null);
  };

  const refreshShortcuts = () => {
    setShortcuts(Repo.getShortcuts());
  };

  const switchTab = (tab: ShortcutTab) => {
    setActiveTab(tab);
    setTextForm(null);
    setLinkForm(null);
    if (audioForm) closeAudioForm();
  };

  const handleSaveText = () => {
    if (!textForm) return;
    if (!textForm.title.trim() || !textForm.text.trim()) {
      Alert.alert(t('Atenção'), t('Preencha o título e o texto da mensagem.'));
      return;
    }

    const shortcut: TextShortcut = {
      id: textForm.id ?? `text-${Date.now()}`,
      title: textForm.title.trim(),
      text: textForm.text.trim(),
    };

    if (textForm.id) {
      Repo.updateTextShortcut(shortcut);
    } else {
      Repo.addTextShortcut(shortcut);
    }
    refreshShortcuts();
    setTextForm(null);
    Alert.alert(t('Sucesso'), textForm.id ? t('Atalho atualizado!') : t('Atalho de texto criado e sincronizado com o teclado!'));
  };

  const handleSaveAudio = () => {
    if (!audioForm) return;
    if (!audioForm.title.trim()) {
      Alert.alert(t('Atenção'), t('Preencha o título do áudio.'));
      return;
    }
    const audioUrl = normalizeUrl(audioForm.url);
    if (!audioUrl) {
      Alert.alert(t('Atenção'), t('Grave o áudio, escolha um arquivo do celular ou cole o link.'));
      return;
    }
    // Trocou o áudio de um atalho que já tinha arquivo na nuvem: apaga o antigo
    const previous = audioForm.id ? shortcuts.audios.find(a => a.id === audioForm.id) : undefined;
    if (previous?.storagePath && previous.storagePath !== audioForm.storagePath) deleteUploadedMedia(previous.storagePath);

    const shortcut: AudioShortcut = {
      id: audioForm.id ?? `audio-${Date.now()}`,
      title: audioForm.title.trim(),
      duration: audioForm.duration.trim(),
      audioUrl,
      transcript: audioForm.transcript.trim(),
      // Link colado à mão não tem arquivo na nuvem
      storagePath: audioForm.storagePath && audioUrl === audioForm.url ? audioForm.storagePath : undefined,
    };

    if (audioForm.id) {
      Repo.updateAudioShortcut(shortcut);
    } else {
      Repo.addAudioShortcut(shortcut);
    }
    refreshShortcuts();
    setPendingUpload(null); // salvo: o arquivo agora pertence ao atalho
    setAudioForm(null);
    Alert.alert(t('Sucesso'), audioForm.id ? t('Áudio atualizado!') : t('Atalho de áudio adicionado e sincronizado com o teclado!'));
  };

  // Mesma regra do teclado (src/shortcuts)
  const handleSaveLink = () => {
    if (!linkForm) return;
    const result = saveLinkShortcut(linkForm.id, linkForm.title, linkForm.url, linkForm.message);
    if (!result.ok) {
      Alert.alert(t('Atenção'), result.error);
      return;
    }
    refreshShortcuts();
    setLinkForm(null);
    Alert.alert(t('Sucesso'), linkForm.id ? t('Atalho atualizado!') : t('Atalho de link criado e sincronizado com o teclado!'));
  };

  const handleDeleteLink = (item: LinkShortcut) => {
    confirmDelete(item.title, () => {
      deleteShortcut('link', item.id);
      refreshShortcuts();
      if (linkForm?.id === item.id) setLinkForm(null);
    });
  };

  const handleDeleteText = (item: TextShortcut) => {
    confirmDelete(item.title, () => {
      Repo.deleteTextShortcut(item.id);
      refreshShortcuts();
      if (textForm?.id === item.id) setTextForm(null);
    });
  };

  const handleDeleteAudio = (item: AudioShortcut) => {
    confirmDelete(item.title, () => {
      Repo.deleteAudioShortcut(item.id);
      deleteUploadedMedia(item.storagePath);
      refreshShortcuts();
      if (audioForm?.id === item.id) setAudioForm(null);
    });
  };

  const renderItemActions = (onEdit: () => void, onDelete: () => void) => (
    <View style={styles.itemActions}>
      <Pressable hitSlop={6} onPress={onEdit}>
        <Text style={styles.linkText}>{t('Editar')}</Text>
      </Pressable>
      <Pressable hitSlop={6} onPress={onDelete}>
        <Text style={styles.deleteText}>{t('Excluir')}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.badge}>{t('Respostas rápidas')}</Text>
          <Text style={styles.headerTitle}>{t('Atalhos do Teclado')}</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            if (activeTab === 'text') setTextForm({ id: null, title: '', text: '' });
            else if (activeTab === 'link') setLinkForm(EMPTY_LINK_FORM);
            else setAudioForm(EMPTY_AUDIO_FORM);
          }}>
          <CoralSheen />
          <Icon name="adicionar" size={18} color={colors.onPrimary} />
          <Text style={styles.addBtnText}>
            {activeTab === 'text' ? t('Novo texto') : activeTab === 'link' ? t('Novo link') : t('Novo áudio')}
          </Text>
        </Pressable>
      </View>

      {/* Alternador de Tipo */}
      <View style={styles.tabToggle}>
        <Pressable
          style={[styles.toggleBtn, activeTab === 'text' && styles.toggleBtnActive]}
          onPress={() => switchTab('text')}>
          <Text style={[styles.toggleText, activeTab === 'text' && styles.toggleTextActive]}>
            {t('Textos ({length})', { length: shortcuts.texts.length })}</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, activeTab === 'audio' && styles.toggleBtnActive]}
          onPress={() => switchTab('audio')}>
          <Text style={[styles.toggleText, activeTab === 'audio' && styles.toggleTextActive]}>
            {t('Áudios ({length})', { length: shortcuts.audios.length })}</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, activeTab === 'link' && styles.toggleBtnActive]}
          onPress={() => switchTab('link')}>
          <Text style={[styles.toggleText, activeTab === 'link' && styles.toggleTextActive]}>
            {t('Links ({length})', { length: shortcuts.links.length })}</Text>
        </Pressable>
      </View>

      {/* Formulário de Link (criar / editar) */}
      {linkForm && (
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>{linkForm.id ? t('Editar link') : t('Novo link')}</Text>
          <Text style={styles.label}>{t('Título')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('Ex: Catálogo, Agendar horário')}
            placeholderTextColor={colors.textMuted}
            value={linkForm.title}
            onChangeText={title => setLinkForm({ ...linkForm, title })}
          />
          <Text style={styles.label}>{t('Link')}</Text>
          <TextInput
            style={styles.input}
            placeholder="https://"
            placeholderTextColor={colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            value={linkForm.url}
            onChangeText={url => setLinkForm({ ...linkForm, url })}
          />
          <Text style={styles.label}>{t('Mensagem antes do link (opcional)')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('Ex: Veja nosso catálogo:')}
            placeholderTextColor={colors.textMuted}
            multiline
            value={linkForm.message}
            onChangeText={message => setLinkForm({ ...linkForm, message })}
          />
          <View style={styles.formBtnsRow}>
            <Pressable style={styles.cancelBtn} onPress={() => setLinkForm(null)}>
              <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSaveLink}>
              <CoralSheen />
              <Text style={styles.saveBtnText}>{t('Salvar Atalho')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Formulário de Texto (criar / editar) */}
      {textForm && (
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>{textForm.id ? t('Editar Atalho de Texto') : t('Novo Atalho de Texto')}</Text>
          <Text style={styles.label}>{t('Título do Atalho')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('Ex: Formas de pagamento, Chave Pix')}
            placeholderTextColor={colors.textMuted}
            value={textForm.title}
            onChangeText={title => setTextForm({ ...textForm, title })}
          />

          <Text style={styles.label}>{t('Conteúdo da Mensagem')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('Escreva a mensagem que será colada no WhatsApp.')}
            placeholderTextColor={colors.textMuted}
            multiline
            value={textForm.text}
            onChangeText={text => setTextForm({ ...textForm, text })}
          />
          <Text style={styles.hint}>
            {t('Variáveis: {{nome}}, {{empresa}} e {{telefone}} são trocadas pelos dados do seu perfil.')}</Text>

          <View style={styles.formBtnsRow}>
            <Pressable style={styles.cancelBtn} onPress={() => setTextForm(null)}>
              <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSaveText}>
              <CoralSheen />
              <Text style={styles.saveBtnText}>{t('Salvar Atalho')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Formulário de Áudio (criar / editar) */}
      {audioForm && (
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>{audioForm.id ? t('Editar Áudio') : t('Novo Áudio Pré-gravado')}</Text>
          <Text style={styles.label}>{t('Título do Áudio')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('Ex: Apresentação Inicial, Proposta Aceita')}
            placeholderTextColor={colors.textMuted}
            value={audioForm.title}
            onChangeText={title => setAudioForm({ ...audioForm, title })}
          />

          <Text style={styles.label}>{t('Áudio')}</Text>
          {recordingSince !== null ? (
            // Gravando: tempo correndo, parar ou cancelar
            <View style={styles.recordBox}>
              <View style={styles.recDot} />
              <Text style={styles.recTime}>{formatDuration(elapsed) || '0:00'}</Text>
              <Text style={styles.recLabel}>{t('Gravando…')}</Text>
              <Pressable style={styles.recCancel} onPress={handleCancelRecording}>
                <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
              </Pressable>
              <Pressable style={styles.recStop} onPress={handleStopRecording}>
                <CoralSheen />
                <Text style={styles.saveBtnText}>{t('Parar e usar')}</Text>
              </Pressable>
            </View>
          ) : audioForm.url && !audioForm.linkMode ? (
            // Já tem áudio: mostra e deixa trocar
            <View style={styles.audioReady}>
              <IconTile name="audio" size={36} />
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{audioForm.storagePath ? t('Áudio salvo na nuvem') : t('Áudio por link')}</Text>
                <Text style={styles.urlText} numberOfLines={1}>
                  {audioForm.duration || (audioForm.storagePath ? t('Pronto para enviar') : audioForm.url)}
                </Text>
              </View>
              <Pressable hitSlop={6} onPress={() => setAudioForm({ ...audioForm, url: '', storagePath: undefined })}>
                <Text style={styles.linkText}>{t('Trocar')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <SourceButtons
                disabled={!!uploader.uploading}
                options={[
                  ...(canRecord ? [{ key: 'audio-record', icon: 'audio' as const, label: t('Gravar agora'), onPress: handleStartRecording }] : []),
                  { key: 'audio-file', icon: 'arquivos', label: t('Arquivo do celular'), onPress: handlePickAudioFile },
                  { key: 'audio-link', icon: 'compartilhar', label: t('Colar link'), onPress: () => setAudioForm({ ...audioForm, linkMode: true }) },
                ]}
              />
              {audioForm.linkMode && (
                <TextInput
                  style={styles.input}
                  placeholder={t('Cole o link direto do arquivo (.mp3, .ogg, .m4a)')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={audioForm.url}
                  onChangeText={url => setAudioForm({ ...audioForm, url, storagePath: undefined })}
                />
              )}
            </>
          )}
          <UploadStatus uploading={uploader.uploading} error={recordError ?? uploader.error} />

          <Text style={styles.label}>{t('Duração (opcional)')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('Ex: 0:45')}
            placeholderTextColor={colors.textMuted}
            value={audioForm.duration}
            onChangeText={duration => setAudioForm({ ...audioForm, duration })}
          />

          <Text style={styles.label}>{t('Transcrição do Áudio (opcional)')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('Texto do áudio para conferência rápida antes de enviar')}
            placeholderTextColor={colors.textMuted}
            multiline
            value={audioForm.transcript}
            onChangeText={transcript => setAudioForm({ ...audioForm, transcript })}
          />

          <View style={styles.formBtnsRow}>
            <Pressable style={styles.cancelBtn} onPress={closeAudioForm}>
              <Text style={styles.cancelBtnText}>{t('Cancelar')}</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (!!uploader.uploading || recordingSince !== null) && styles.disabledBtn]}
              disabled={!!uploader.uploading || recordingSince !== null}
              onPress={handleSaveAudio}>
              <CoralSheen />
              <Text style={styles.saveBtnText}>{t('Salvar Áudio')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Lista de Atalhos */}
      {activeTab === 'link' ? (
        <FlatList
          data={shortcuts.links}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            linkForm ? null : (
              <EmptyState
                icon="compartilhar"
                title={t('Nenhum link')}
                text={t('Salve os links que você manda sempre (catálogo, agenda online, site) e envie pelo teclado com um toque.')}
                actionLabel={t('Criar atalho de link')}
                onAction={() => setLinkForm(EMPTY_LINK_FORM)}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHead}>
                <IconTile name="compartilhar" size={36} />
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
              {item.message ? <Text style={styles.itemSub} numberOfLines={2}>{item.message}</Text> : null}
              <Text style={styles.urlText} numberOfLines={1}>
                {item.url}
              </Text>
              {renderItemActions(
                () => setLinkForm({ id: item.id, title: item.title, url: item.url, message: item.message ?? '' }),
                () => handleDeleteLink(item),
              )}
            </View>
          )}
        />
      ) : activeTab === 'text' ? (
        <FlatList
          data={shortcuts.texts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            textForm ? null : (
              <EmptyState
                icon="respostas"
                title={t('Nenhum atalho de texto')}
                text={t('Salve as mensagens que você manda sempre e envie pelo teclado com um toque.')}
                actionLabel={t('Criar atalho de texto')}
                onAction={() => setTextForm({ id: null, title: '', text: '' })}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHead}>
                <IconTile name="respostas" size={36} />
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
              <Text style={styles.itemSub} numberOfLines={2}>{item.text}</Text>
              {renderItemActions(
                () => setTextForm({ id: item.id, title: item.title, text: item.text }),
                () => handleDeleteText(item),
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={shortcuts.audios}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            audioForm ? null : (
              <EmptyState
                icon="audio"
                title={t('Nenhum áudio')}
                text={t('Grave ou escolha um áudio para enviar na conversa sem gravar de novo.')}
                actionLabel={t('Adicionar áudio')}
                onAction={() => setAudioForm(EMPTY_AUDIO_FORM)}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemHead}>
                <IconTile name="audio" size={36} />
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.duration ? <Text style={styles.durationBadge}>{item.duration}</Text> : null}
              </View>
              {item.transcript ? <Text style={styles.transcriptText}>"{item.transcript}"</Text> : null}
              <Text style={styles.urlText} numberOfLines={1}>
                {item.storagePath ? t('Áudio salvo na nuvem') : item.audioUrl}
              </Text>
              {renderItemActions(
                () =>
                  setAudioForm({
                    id: item.id,
                    title: item.title,
                    url: item.audioUrl,
                    duration: item.duration,
                    transcript: item.transcript,
                    storagePath: item.storagePath,
                  }),
                () => handleDeleteAudio(item),
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  recordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recTime: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  recLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  recCancel: { paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center' },
  recStop: {
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    ...coralGlass(colors, { pill: false }),
  },
  audioReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  disabledBtn: { opacity: 0.5 },
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    ...typography.overline,
    color: colors.primaryText,
    marginBottom: 2,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
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
  addBtnText: {
    ...onCoralText,
    color: colors.onPrimary,
    ...typography.button,
  },
  tabToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
  },
  toggleBtn: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primarySoft,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  itemCard: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  itemSub: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  linkText: { color: colors.primaryText, fontSize: 14, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  durationBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.violet,
    backgroundColor: colors.violetBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  transcriptText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  urlText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  formContainer: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.sm,
    maxHeight: 380,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: touchTarget,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formBtnsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.text, ...typography.button },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    minHeight: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    alignItems: 'center',
    ...coralGlass(colors),
  },
  saveBtnText: { color: colors.onPrimary, ...typography.button, ...onCoralText },
}));
