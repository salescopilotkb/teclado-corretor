/**
 * Arquivos no teclado: pastas e subpastas com as fotos e vídeos do dia a dia.
 * Dá para criar, renomear, mover e excluir pastas e arquivos, adicionar da
 * galeria ou da câmera e enviar para a conversa. Tudo grava no mesmo
 * armazenamento do app (Repo): o que muda aqui aparece no app e vice-versa.
 *
 * Sem Alert (o teclado não pode abrir janelas): a confirmação de excluir
 * aparece na própria tela.
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { t } from '../../i18n';
import { useKeyboardBack } from '../../navigation/back';
import {
  descendantIds,
  fileLink,
  filesIn,
  folderPath,
  folderPathLabel,
  folderSummary,
  moveTargets,
  newFileFolderId,
  savedFileFrom,
  subfolders,
} from '../../files/files';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import type { KeyboardPickSource } from '../../native/KeyboardBridge';
import { deleteUploadedMedia } from '../../services/mediaUpload';
import { Repo } from '../../storage/storage';
import type { FilesData, SavedFile } from '../../types';
import { UploadStatus, useUploader } from '../../app/components/MediaUpload';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, useColors } from '../theme';
import { CoralSheen } from './Glass';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { ItemCard } from './ItemCard';
import { DEMO_MODE } from '../../config/demo';
import { ActionButton, AppOnlyNote, BarButton, ConfirmDelete, UseButton } from './KeyboardButtons';
import { Header } from './KeyboardCRM';
import { MAX_RESULTS, NoResults, ResultsSection, SearchLauncher, SearchPanel, matches } from './KeyboardSearch';
import { KeyboardFormField, KeyboardFormKeys, useKeyboardForm } from './KeyboardForm';
import type { FormFieldSpec } from './KeyboardForm';

interface Props {
  files: FilesData;
  /** Foto direto na conversa (cai no link se o app não aceitar). */
  onSendImage: (url: string, title: string) => void;
  /** Compartilhamento do Android (vídeos); fallbackText é inserido se falhar. */
  onShare: (urls: string[], fallbackText: string) => void;
  onInsert: (text: string) => void;
  /** Os formulários (nome da pasta...) abrem com o teclado em tela grande. */
  onExpandedChange: (expanded: boolean) => void;
  /** Depois de gravar: relê os dados. */
  onChanged: () => void;
}

type Screen =
  | { name: 'browse' }
  | { name: 'search' }
  | { name: 'add' }
  | { name: 'file'; id: string }
  | { name: 'folder-options' }
  | { name: 'move'; kind: 'file' | 'folder'; id: string }
  | { name: 'name'; kind: 'new-folder' | 'rename-folder' | 'rename-file'; id?: string };

export function FilesTab({ files, onSendImage, onShare, onInsert, onExpandedChange, onChanged }: Props) {
  /** Pasta aberta (null = início). */
  const [folderId, setFolderId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'browse' });
  const uploader = useUploader();

  // A pasta aberta foi excluída (no app ou aqui): volta para a mais próxima que existe
  const folder = folderId ? files.folders.find(f => f.id === folderId) : undefined;
  useEffect(() => {
    if (folderId && !folder) setFolderId(null);
  }, [folderId, folder]);

  // Formulários e busca: o teclado de letras precisa da tela grande
  const typing = screen.name === 'name' || screen.name === 'search';
  useEffect(() => {
    onExpandedChange(typing);
  }, [typing, onExpandedChange]);
  // Sair da aba com um formulário aberto: o teclado volta ao normal
  useEffect(() => () => onExpandedChange(false), [onExpandedChange]);

  const browse = () => setScreen({ name: 'browse' });

  const add = (source: KeyboardPickSource) => {
    const target = folderId;
    browse();
    uploader.run(
      () => KeyboardBridge.pickMedia(source),
      (uploaded, media) => {
        Repo.saveFile(savedFileFrom(media, uploaded, target));
        onChanged();
      },
    );
  };

  const send = (file: SavedFile) => {
    if (file.type === 'image') onSendImage(file.url, file.title);
    else onShare([file.url], fileLink(file));
  };

  if (screen.name === 'name') {
    const file = screen.kind === 'rename-file' ? files.files.find(f => f.id === screen.id) : undefined;
    const initial = screen.kind === 'rename-folder' ? folder?.name ?? '' : file?.title ?? '';
    const title =
      screen.kind === 'new-folder'
        ? folder
          ? t('Nova subpasta')
          : t('Nova pasta')
        : screen.kind === 'rename-folder'
          ? t('Renomear pasta')
          : t('Renomear arquivo');
    return (
      <NameForm
        title={title}
        label={screen.kind === 'rename-file' ? 'Nome do arquivo' : 'Nome da pasta'}
        initial={initial}
        onCancel={() => (file ? setScreen({ name: 'file', id: file.id }) : browse())}
        onSave={name => {
          if (screen.kind === 'new-folder') {
            const id = newFileFolderId();
            Repo.saveFileFolder({ id, name, parentId: folderId, createdAt: new Date().toISOString() });
            setFolderId(id);
            browse();
          } else if (screen.kind === 'rename-folder' && folder) {
            Repo.saveFileFolder({ ...folder, name });
            browse();
          } else if (file) {
            Repo.saveFile({ ...file, title: name });
            setScreen({ name: 'file', id: file.id });
          }
          onChanged();
        }}
      />
    );
  }

  if (screen.name === 'search') {
    return (
      <SearchPanel testID="files-search" placeholder={t('Buscar pastas e arquivos')} onClose={browse}>
        {query => {
          const hitFolders = files.folders.filter(f => matches(query, f.name)).slice(0, MAX_RESULTS);
          const hitFiles = files.files.filter(f => matches(query, f.title)).slice(0, MAX_RESULTS);
          if (!hitFolders.length && !hitFiles.length) return <NoResults query={query} />;
          return (
            <>
              {hitFolders.length > 0 && <ResultsSection title={t('Pastas')} />}
              {hitFolders.map(f => (
                <ItemCard
                  key={f.id}
                  testID={`search-ffolder-${f.id}`}
                  title={f.name}
                  subtitle={folderPathLabel(files, f.parentId)}
                  meta={folderSummary(files, f.id)}
                  icon="pasta"
                  onPress={() => {
                    setFolderId(f.id);
                    browse();
                  }}
                />
              ))}
              {hitFiles.length > 0 && <ResultsSection title={t('Arquivos')} />}
              {hitFiles.map(f => (
                <ItemCard
                  key={f.id}
                  testID={`search-file-${f.id}`}
                  title={f.title}
                  subtitle={folderPathLabel(files, f.folderId)}
                  meta={f.type === 'video' ? f.duration || t('Vídeo') : undefined}
                  imageUri={f.type === 'image' ? f.url : undefined}
                  icon={f.type === 'video' ? 'video' : undefined}
                  onPress={() => {
                    setFolderId(f.folderId);
                    setScreen({ name: 'file', id: f.id });
                  }}
                  trailing={
                    <UseButton
                      testID={`use-search-file-${f.id}`}
                      onPress={() => {
                        // Usou: fecha a busca e o teclado volta ao tamanho normal
                        browse();
                        send(f);
                      }}
                      onLongPress={() => {
                        browse();
                        onInsert(fileLink(f));
                      }}
                    />
                  }
                />
              ))}
            </>
          );
        }}
      </SearchPanel>
    );
  }

  if (screen.name === 'add') {
    return <AddSheet inFolder={folder?.name} onPick={add} onCancel={browse} />;
  }

  const moving =
    screen.name !== 'move'
      ? undefined
      : screen.kind === 'folder'
        ? files.folders.find(f => f.id === screen.id)
        : files.files.find(f => f.id === screen.id);
  if (screen.name === 'move' && moving) {
    const isFolder = screen.kind === 'folder';
    const current = 'parentId' in moving ? moving.parentId : moving.folderId;
    return (
      <MoveList
        title={isFolder ? t('Mover pasta') : t('Mover arquivo')}
        targets={moveTargets(files, isFolder ? descendantIds(files, screen.id) : undefined)}
        current={current ?? null}
        onCancel={() => (isFolder ? setScreen({ name: 'folder-options' }) : setScreen({ name: 'file', id: screen.id }))}
        onMove={to => {
          if ('parentId' in moving) Repo.saveFileFolder({ ...moving, parentId: to });
          else Repo.saveFile({ ...moving, folderId: to });
          onChanged();
          if (isFolder) browse();
          else {
            // Vai junto para a pasta nova, para ver o arquivo no lugar
            setFolderId(to);
            setScreen({ name: 'file', id: screen.id });
          }
        }}
      />
    );
  }

  if (screen.name === 'folder-options' && folder) {
    return (
      <FolderOptions
        name={folder.name}
        summary={folderSummary(files, folder.id)}
        onBack={browse}
        onRename={() => setScreen({ name: 'name', kind: 'rename-folder' })}
        onMove={() => setScreen({ name: 'move', kind: 'folder', id: folder.id })}
        onDelete={() => {
          const removed = Repo.deleteFileFolder(folder.id);
          removed.forEach(f => deleteUploadedMedia(f.storagePath));
          setFolderId(folder.parentId);
          browse();
          onChanged();
        }}
      />
    );
  }

  if (screen.name === 'file') {
    const file = files.files.find(f => f.id === screen.id);
    if (file) {
      return (
        <FileDetail
          file={file}
          onBack={browse}
          onSend={() => send(file)}
          onSendLink={() => onInsert(fileLink(file))}
          onRename={() => setScreen({ name: 'name', kind: 'rename-file', id: file.id })}
          onMove={() => setScreen({ name: 'move', kind: 'file', id: file.id })}
          onDelete={() => {
            Repo.deleteFile(file.id);
            deleteUploadedMedia(file.storagePath);
            browse();
            onChanged();
          }}
        />
      );
    }
  }

  return (
    <Browser
      files={files}
      folderId={folder ? folderId : null}
      uploader={uploader}
      onOpenFolder={setFolderId}
      onUp={() => setFolderId(folder?.parentId ?? null)}
      onOpenFile={id => setScreen({ name: 'file', id })}
      onUseFile={send}
      onUseFileLink={file => onInsert(fileLink(file))}
      onAdd={() => setScreen({ name: 'add' })}
      onNewFolder={() => setScreen({ name: 'name', kind: 'new-folder' })}
      onFolderOptions={() => setScreen({ name: 'folder-options' })}
      onSearch={() => setScreen({ name: 'search' })}
    />
  );
}

// ── Lista da pasta ──────────────────────────────────────────────────────

function Browser({
  files,
  folderId,
  uploader,
  onOpenFolder,
  onUp,
  onOpenFile,
  onUseFile,
  onUseFileLink,
  onAdd,
  onNewFolder,
  onFolderOptions,
  onSearch,
}: {
  files: FilesData;
  folderId: string | null;
  uploader: ReturnType<typeof useUploader>;
  onOpenFolder: (id: string) => void;
  onUp: () => void;
  onOpenFile: (id: string) => void;
  onUseFile: (file: SavedFile) => void;
  onUseFileLink: (file: SavedFile) => void;
  onAdd: () => void;
  onNewFolder: () => void;
  onFolderOptions: () => void;
  onSearch: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const folders = subfolders(files, folderId);
  // Dentro de uma pasta, o "voltar" do celular sobe uma pasta
  useKeyboardBack(onUp, folderId !== null);
  const items = filesIn(files, folderId);
  const path = folderPath(files, folderId);
  const current = path[path.length - 1];

  return (
    <View style={styles.flex} testID="files-tab">
      <View style={styles.bar}>
        {current ? (
          <Pressable testID="files-up" accessibilityRole="button" accessibilityLabel={t('Voltar')} hitSlop={8} style={styles.barBack} onPress={onUp}>
            <Icon name="voltar" size={20} color={colors.textMuted} />
            <View style={styles.flex}>
              {path.length > 1 && (
                <Text style={styles.barPath} numberOfLines={1}>
                  {path
                    .slice(0, -1)
                    .map(f => f.name)
                    .join(' › ')}
                </Text>
              )}
              <Text style={styles.barTitle} numberOfLines={1}>
                {current.name}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Text style={[styles.barTitle, styles.barTitleRoot]}>{t('Arquivos')}</Text>
        )}
        {current && <BarButton testID="files-folder-options" icon="editar" label={t('Editar pasta')} onPress={onFolderOptions} />}
        <BarButton testID="files-new-folder" icon="novaPasta" label={current ? t('Nova subpasta') : t('Nova pasta')} onPress={onNewFolder} />
        <BarButton testID="files-add" icon="adicionar" label={t('Adicionar foto ou vídeo')} primary onPress={onAdd} disabled={!!uploader.uploading} />
      </View>
      <SearchLauncher testID="files-search-open" placeholder={t('Buscar pastas e arquivos')} onPress={onSearch} />

      {(uploader.uploading || uploader.error) && (
        <View style={styles.status}>
          <UploadStatus uploading={uploader.uploading} error={uploader.error} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="always">
        {folders.map(f => (
          <ItemCard
            key={f.id}
            testID={`ffolder-${f.id}`}
            title={f.name}
            meta={folderSummary(files, f.id)}
            icon="pasta"
            onPress={() => onOpenFolder(f.id)}
          />
        ))}

        {items.length > 0 && (
          <View style={styles.grid}>
            {items.map(file => (
              <Thumb
                key={file.id}
                file={file}
                onPress={() => onOpenFile(file.id)}
                onUse={() => onUseFile(file)}
                onUseLink={() => onUseFileLink(file)}
              />
            ))}
          </View>
        )}

        {folders.length === 0 && items.length === 0 && (
          <Text style={styles.empty}>
            {current
              ? t('Pasta vazia. Toque em + para adicionar fotos e vídeos, ou crie uma subpasta.')
              : t('Organize aqui as fotos e vídeos que você usa no dia a dia. Crie uma pasta ou toque em + para adicionar.')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

/** Miniatura: a foto em si; vídeo = ícone e duração. Embaixo, "Usar" envia direto. */
function Thumb({ file, onPress, onUse, onUseLink }: { file: SavedFile; onPress: () => void; onUse: () => void; onUseLink: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.thumbCell}>
      <Pressable
        testID={`file-${file.id}`}
        accessibilityRole="button"
        accessibilityLabel={file.title}
        onPress={onPress}
        style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}>
        {file.type === 'image' ? (
          <Image source={{ uri: file.url }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbVideo}>
            <Icon name="video" size={24} color={colors.textSecondary} />
            {file.duration ? <Text style={styles.thumbDuration}>{file.duration}</Text> : null}
          </View>
        )}
        <Text style={styles.thumbTitle} numberOfLines={1}>
          {file.title}
        </Text>
      </Pressable>
      <UseButton testID={`use-file-${file.id}`} compact onPress={onUse} onLongPress={onUseLink} />
    </View>
  );
}

// ── Adicionar ───────────────────────────────────────────────────────────

function AddSheet({ inFolder, onPick, onCancel }: { inFolder?: string; onPick: (s: KeyboardPickSource) => void; onCancel: () => void }) {
  const styles = useStyles();
  const options: Array<{ source: KeyboardPickSource; icon: IconName; label: string }> = [
    { source: 'gallery', icon: 'galeria', label: t('Galeria') },
    { source: 'camera-photo', icon: 'foto', label: t('Tirar foto') },
    { source: 'camera-video', icon: 'video', label: t('Gravar vídeo') },
  ];
  return (
    <View style={styles.flex}>
      <Header title={inFolder ? t('Adicionar em {folder}', { folder: inFolder }) : t('Adicionar arquivo')} onBack={onCancel} />
      <View style={styles.sheet}>
        {!KeyboardBridge.canPickMedia ? (
          <AppOnlyNote
            testID="files-app-only"
            text={t('No iPhone, a Apple não deixa o teclado abrir a galeria nem a câmera. Adicione fotos e vídeos pelo app KEYCON: eles aparecem aqui na hora.')}
          />
        ) : (
        <>
        <View style={styles.sources}>
          {options.map(o => (
            <Pressable
              key={o.source}
              testID={`files-source-${o.source}`}
              accessibilityRole="button"
              style={({ pressed }) => [styles.source, pressed && styles.pressed]}
              onPress={() => onPick(o.source)}>
              <Icon name={o.icon} size={26} />
              <Text style={styles.sourceText}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          {DEMO_MODE
            ? t('A galeria abre por cima da conversa. Nesta demonstração, o arquivo fica só neste navegador e some ao recarregar a página.')
            : t('A galeria abre por cima da conversa. O arquivo vai para a nuvem e aparece também no app.')}
        </Text>
        </>
        )}
      </View>
    </View>
  );
}

// ── Arquivo aberto ──────────────────────────────────────────────────────

function FileDetail({
  file,
  onBack,
  onSend,
  onSendLink,
  onRename,
  onMove,
  onDelete,
}: {
  file: SavedFile;
  onBack: () => void;
  onSend: () => void;
  onSendLink: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.flex}>
      <Header title={file.title} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detail} keyboardShouldPersistTaps="always">
        <View style={styles.previewRow}>
          {file.type === 'image' ? (
            <Image source={{ uri: file.url }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={[styles.preview, styles.thumbVideo]}>
              <Icon name="video" size={32} color={colors.textSecondary} />
              {file.duration ? <Text style={styles.thumbDuration}>{file.duration}</Text> : null}
            </View>
          )}
          <View style={styles.previewActions}>
            <Pressable
              testID="file-send"
              accessibilityRole="button"
              accessibilityHint={t('Segure para enviar só o link')}
              style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
              onPress={onSend}
              onLongPress={onSendLink}>
              <CoralSheen radius={radius.sm} />
              <Icon name="compartilhar" size={18} color={colors.onPrimary} />
              <Text style={styles.sendText}>{file.type === 'image' ? t('Enviar foto') : t('Enviar vídeo')}</Text>
            </Pressable>
            <Text style={styles.hint}>{t('Segure para enviar só o link.')}</Text>
          </View>
        </View>

        {confirming ? (
          <ConfirmDelete
            testID="file-delete-confirm"
            message={t('Excluir este arquivo do app e do teclado?')}
            onCancel={() => setConfirming(false)}
            onConfirm={onDelete}
          />
        ) : (
          <View style={styles.row}>
            <ActionButton testID="file-rename" icon="editar" label={t('Renomear')} onPress={onRename} />
            <ActionButton testID="file-move" icon="mover" label={t('Mover')} onPress={onMove} />
            <ActionButton testID="file-delete" icon="lixeira" label={t('Excluir')} onPress={() => setConfirming(true)} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Pasta: renomear, mover, excluir ─────────────────────────────────────

function FolderOptions({
  name,
  summary,
  onBack,
  onRename,
  onMove,
  onDelete,
}: {
  name: string;
  summary: string;
  onBack: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={styles.flex}>
      <Header title={name} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detail} keyboardShouldPersistTaps="always">
        <Text style={styles.hint}>{summary}</Text>
        {confirming ? (
          <ConfirmDelete
            testID="folder-delete-confirm"
            message={t('Excluir a pasta com tudo o que tem dentro (subpastas, fotos e vídeos)?')}
            onCancel={() => setConfirming(false)}
            onConfirm={onDelete}
          />
        ) : (
          <View style={styles.row}>
            <ActionButton testID="folder-rename" icon="editar" label={t('Renomear')} onPress={onRename} />
            <ActionButton testID="folder-move" icon="mover" label={t('Mover')} onPress={onMove} />
            <ActionButton testID="folder-delete" icon="lixeira" label={t('Excluir')} onPress={() => setConfirming(true)} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MoveList({
  title,
  targets,
  current,
  onCancel,
  onMove,
}: {
  title: string;
  targets: Array<{ id: string | null; label: string }>;
  current: string | null;
  onCancel: () => void;
  onMove: (to: string | null) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.flex}>
      <Header title={title} onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="always">
        {targets.map(target => {
          const here = target.id === current;
          return (
            <Pressable
              key={target.id ?? 'root'}
              testID={`move-to-${target.id ?? 'root'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: here }}
              disabled={here}
              style={({ pressed }) => [styles.moveRow, here && styles.moveRowHere, pressed && styles.pressed]}
              onPress={() => onMove(target.id)}>
              <Icon name="pasta" size={18} color={here ? colors.primaryText : colors.textSecondary} />
              <Text style={[styles.moveText, here && styles.moveTextHere]} numberOfLines={1}>
                {target.label}
              </Text>
              {here && <Text style={styles.moveHere}>{t('Aqui')}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Nome (pasta nova, renomear) ─────────────────────────────────────────

function NameForm({
  title,
  label,
  initial,
  onCancel,
  onSave,
}: {
  title: string;
  label: string;
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const styles = useStyles();
  const [fields] = useState<FormFieldSpec[]>(() => [{ key: 'name', label, placeholder: 'Toque e digite' }]);
  const form = useKeyboardForm(fields, { name: initial });
  const name = (form.values.name ?? '').trim();
  return (
    <View style={styles.flex}>
      <Header title={title} onBack={onCancel} actionLabel={t('Salvar')} onAction={() => name && onSave(name)} disabled={!name} />
      <View style={styles.form}>
        <KeyboardFormField spec={fields[0]} value={form.values.name ?? ''} active onPress={() => form.setActive('name')} />
      </View>
      <View style={styles.flex} />
      <KeyboardFormKeys sink={form.sink} activeKey={form.active} />
    </View>
  );
}

const THUMB = 76;

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
  },
  barBack: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barPath: { fontSize: 11, color: colors.textMuted },
  barTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  barTitleRoot: { flex: 1, paddingLeft: spacing.xs },
  status: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  list: { padding: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbCell: { width: THUMB, gap: 4 },
  thumb: { width: THUMB, gap: 3 },
  thumbImage: { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbVideo: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  thumbDuration: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  thumbTitle: { fontSize: 11, color: colors.textSecondary },
  sheet: { padding: spacing.md, gap: spacing.md },
  sources: { flexDirection: 'row', gap: spacing.sm },
  source: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  sourceText: { fontSize: 13, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  detail: { padding: spacing.sm, gap: spacing.sm },
  previewRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  preview: { width: 112, height: 112, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  previewActions: { flex: 1, gap: spacing.xs },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: touchTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    ...coralGlass(colors, { pill: false }),
  },
  sendText: { ...onCoralText, color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  moveRowHere: { backgroundColor: colors.primarySoft },
  moveText: { flex: 1, fontSize: 14, color: colors.text },
  moveTextHere: { color: colors.primaryText, fontWeight: '600' },
  moveHere: { fontSize: 12, color: colors.primaryText },
  form: { padding: spacing.sm },
}));
