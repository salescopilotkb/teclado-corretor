/**
 * Arquivos no app: pastas e subpastas com fotos e vídeos do dia a dia, os
 * mesmos do teclado (Repo). Volta a ler ao reabrir o app, para mostrar o que
 * foi feito pelo teclado nesse meio-tempo.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Pressable, Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { useAppBack } from '../../navigation/back';
import {
  descendantIds,
  filesIn,
  folderPath,
  folderSummary,
  moveTargets,
  newFileFolderId,
  newFileId,
  savedFileFrom,
  subfolders,
  LOCKER_NAME,
} from '../../files/files';
import {
  lockerDeleteFile,
  lockerDeleteFolder,
  lockerFileLink,
  lockerFolderLink,
  lockerSaveFile,
  lockerSaveFolder,
  onLockerChange,
  openLockerWeb,
  setFolderVisibility,
  uploadToLocker,
} from '../../files/locker';
import Clipboard from '@react-native-clipboard/clipboard';
import { ChoiceRow } from '../../keyboard/components/KeyboardForm';
import { Icon } from '../../keyboard/components/Icon';
import { makeStyles, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { canUseCamera, captureWithCamera, pickPhotoOrVideo } from '../../native/MediaPicker';
import { deleteUploadedMedia } from '../../services/mediaUpload';
import type { LocalMedia } from '../../services/mediaUpload';
import { Repo } from '../../storage/storage';
import { DEMO_MODE } from '../../config/demo';
import type { FileFolder, FilesData, FolderVisibility, SavedFile } from '../../types';
import { normalizeUrl } from '../../utils/formatters';
import { SourceButtons, UploadStatus, useUploader } from '../components/MediaUpload';
import { Button, Card, CardText, CardTitle, EmptyState, MenuGroup, MenuRow, Page, ScreenTitle, SubHeader } from '../components/ui';

type Mode = null | 'add' | 'link' | 'new-folder' | 'rename-folder' | 'move-folder';

/** onBack: aberta de dentro de outra tela (sem ele, é a aba Arquivos do menu). */
export function FilesManagerScreen({ onBack }: { onBack?: () => void } = {}) {
  const styles = useStyles();
  const [data, setData] = useState<FilesData>(() => Repo.getFiles());
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const uploader = useUploader();

  const reload = useCallback(() => setData(Repo.getFiles()), []);
  const [openingWeb, setOpeningWeb] = useState(false);
  // Mudou no Locker (outro aparelho, o Locker web ou o teclado): mostra na hora
  useEffect(() => onLockerChange(reload), [reload]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => s === 'active' && reload());
    return () => sub.remove();
  }, [reload]);

  const folder = folderId ? data.folders.find(f => f.id === folderId) : undefined;
  // "Voltar" do celular com "Nova pasta" ou "Adicionar" aberto no início: fecha o formulário
  // (dentro de uma pasta, o Voltar da pasta já fecha o formulário antes)
  useAppBack(() => setMode(null), !!mode && !folder);
  // Pasta excluída pelo teclado: volta ao início
  useEffect(() => {
    if (folderId && !folder) setFolderId(null);
  }, [folderId, folder]);

  const file = fileId ? data.files.find(f => f.id === fileId) : undefined;
  if (file) {
    return (
      <FileDetail
        file={file}
        data={data}
        onBack={() => setFileId(null)}
        onChanged={reload}
        onMoved={to => setFolderId(to)}
      />
    );
  }

  const open = (id: string | null) => {
    setFolderId(id);
    setMode(null);
  };
  const startName = (m: 'new-folder' | 'rename-folder') => {
    setName(m === 'rename-folder' ? folder?.name ?? '' : '');
    setMode(m);
  };
  const saveName = () => {
    const clean = name.trim();
    if (!clean) return;
    if (mode === 'rename-folder' && folder) {
      lockerSaveFolder({ ...folder, name: clean });
    } else {
      const id = newFileFolderId();
      lockerSaveFolder({ id, name: clean, parentId: folderId, createdAt: new Date().toISOString() });
      setFolderId(id);
    }
    setMode(null);
    reload();
  };

  const add = (pick: () => Promise<LocalMedia | null>) => {
    const target = folderId;
    setMode(null);
    uploader.run(
      pick,
      (uploaded, media) => {
        lockerSaveFile(savedFileFrom(media, uploaded, target));
        reload();
      },
      // Arquivos vão para o Locker (Cloudflare R2)
      uploadToLocker,
    );
  };

  const deleteFolder = () => {
    if (!folder) return;
    Alert.alert(t('Excluir pasta'), t('Excluir "{name}" com tudo o que tem dentro (subpastas, fotos e vídeos)?', { name: folder.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: () => {
          lockerDeleteFolder(folder.id).forEach(f => deleteUploadedMedia(f.storagePath));
          setFolderId(folder.parentId);
          setMode(null);
          reload();
        },
      },
    ]);
  };

  const path = folderPath(data, folderId);
  const folders = subfolders(data, folderId);
  const items = filesIn(data, folderId);
  const parentLabel = path.length > 1 ? path[path.length - 2].name : LOCKER_NAME;

  return (
    <Page>
      {folder ? (
        <SubHeader title={folder.name} onBack={() => (mode ? setMode(null) : open(folder.parentId))} />
      ) : onBack ? (
        <SubHeader title={LOCKER_NAME} subtitle={t('Fotos e vídeos em pastas, também no teclado')} onBack={onBack} />
      ) : (
        <ScreenTitle title={LOCKER_NAME} subtitle={t('Fotos e vídeos em pastas, também no teclado')} />
      )}
      {folder && path.length > 1 ? <Text style={styles.path}>{t('Em {folder}', { folder: parentLabel })}</Text> : null}

      {/* Locker no navegador (locker.keyconapp.com), já logado: o app gera um link de entrada de uso único.
          Na demonstração ainda não aparece: o Locker de exemplo vem na tarefa 13 */}
      {!folder && !mode && !DEMO_MODE ? (
        <Button
          testID="locker-open-web"
          label={t('Abrir o Locker no navegador')}
          variant="secondary"
          icon="globo"
          loading={openingWeb}
          onPress={() => {
            setOpeningWeb(true);
            openLockerWeb()
              .catch(() => Alert.alert(t('Erro'), t('Não foi possível abrir o Locker no navegador.')))
              .finally(() => setOpeningWeb(false));
          }}
        />
      ) : null}

      {mode === 'new-folder' || mode === 'rename-folder' ? (
        <Card>
          <CardTitle>{mode === 'rename-folder' ? t('Renomear pasta') : folder ? t('Nova subpasta') : t('Nova pasta')}</CardTitle>
          <NameInput value={name} onChange={setName} onSubmit={saveName} placeholder={t('Ex: Fotos de clientes, Vídeos de obra')} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label={t('Cancelar')} variant="secondary" onPress={() => setMode(null)} />
            </View>
            <View style={styles.flex}>
              <Button testID="files-save-name" label={t('Salvar')} onPress={saveName} disabled={!name.trim()} />
            </View>
          </View>
        </Card>
      ) : mode === 'add' ? (
        <Card>
          <CardTitle>{t('Adicionar foto ou vídeo')}</CardTitle>
          <SourceButtons
            options={[
              { key: 'gallery', icon: 'galeria', label: t('Galeria'), onPress: () => add(pickPhotoOrVideo) },
              ...(canUseCamera
                ? [
                    { key: 'camera-photo', icon: 'foto' as const, label: t('Tirar foto'), onPress: () => add(() => captureWithCamera('image')) },
                    { key: 'camera-video', icon: 'video' as const, label: t('Gravar vídeo'), onPress: () => add(() => captureWithCamera('video')) },
                  ]
                : []),
              { key: 'link', icon: 'compartilhar', label: t('Link'), onPress: () => setMode('link') },
            ]}
          />
          <Button label={t('Cancelar')} variant="secondary" onPress={() => setMode(null)} />
        </Card>
      ) : mode === 'link' ? (
        <LinkForm
          onCancel={() => setMode(null)}
          onSave={(title, url, type) => {
            lockerSaveFile({ id: newFileId(), folderId, type, title, url, createdAt: new Date().toISOString() });
            setMode(null);
            reload();
          }}
        />
      ) : mode === 'move-folder' && folder ? (
        <MoveCard
          title={t('Mover pasta para')}
          targets={moveTargets(data, descendantIds(data, folder.id))}
          current={folder.parentId}
          onCancel={() => setMode(null)}
          onMove={to => {
            lockerSaveFolder({ ...folder, parentId: to });
            setMode(null);
            reload();
          }}
        />
      ) : (
        <View style={styles.actions}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button testID="files-add" label={t('Adicionar')} icon="adicionar" onPress={() => setMode('add')} disabled={!!uploader.uploading} />
            </View>
            <View style={styles.flex}>
              <Button
                testID="files-new-folder"
                label={folder ? t('Subpasta') : t('Nova pasta')}
                icon="novaPasta"
                variant="secondary"
                onPress={() => startName('new-folder')}
              />
            </View>
          </View>
          {folder && (
            <View style={styles.row}>
              <SmallAction icon="editar" label={t('Renomear')} onPress={() => startName('rename-folder')} />
              <SmallAction icon="mover" label={t('Mover')} onPress={() => setMode('move-folder')} />
              <SmallAction icon="lixeira" label={t('Excluir')} danger onPress={deleteFolder} />
            </View>
          )}
          {folder && <FolderSharing folder={folder} onChanged={reload} />}
        </View>
      )}

      <UploadStatus uploading={uploader.uploading} error={uploader.error} />

      {folders.length > 0 && (
        <MenuGroup>
          {folders.map(f => (
            <MenuRow key={f.id} testID={`ffolder-${f.id}`} icon="pasta" title={f.name} subtitle={folderSummary(data, f.id)} onPress={() => open(f.id)} />
          ))}
        </MenuGroup>
      )}

      {items.length > 0 && (
        <View style={styles.grid}>
          {items.map(f => (
            <Thumb key={f.id} file={f} onPress={() => setFileId(f.id)} />
          ))}
        </View>
      )}

      {folders.length === 0 && items.length === 0 && mode === null && (
        <EmptyState
          icon="galeria"
          title={folder ? t('Pasta vazia') : t('Seu Locker')}
          text={
            folder
              ? t('Adicione fotos e vídeos ou crie uma subpasta.')
              : t('Guarde e organize em pastas as fotos e vídeos que você usa no dia a dia. Eles aparecem também no teclado, prontos para enviar.')
          }
        />
      )}
    </Page>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS: Array<{ value: FolderVisibility; label: string; hint: string }> = [
  { value: 'private', label: 'Privada', hint: 'Só você vê esta pasta. Os links de cada arquivo continuam abrindo para quem os recebeu.' },
  { value: 'link', label: 'Só com o link', hint: 'Quem tiver o link da pasta vê os arquivos dela, sem precisar entrar numa conta.' },
  { value: 'public', label: 'Pública', hint: 'Como "Só com o link", e também aparece na sua vitrine pública do Locker.' },
];

/** Quem pode ver a pasta pelo Locker (locker.keyconapp.com) e o link dela. */
function FolderSharing({ folder, onChanged }: { folder: FileFolder; onChanged: () => void }) {
  const styles = useStyles();
  const visibility = folder.visibility ?? 'private';
  const option = VISIBILITY_OPTIONS.find(o => o.value === visibility) ?? VISIBILITY_OPTIONS[0];
  return (
    <Card>
      <CardTitle>{t('Quem pode ver esta pasta')}</CardTitle>
      <ChoiceRow
        onCard
        options={VISIBILITY_OPTIONS.map(o => ({ value: o.value, label: t(o.label) }))}
        value={visibility}
        onChange={v => {
          setFolderVisibility(folder, v);
          onChanged();
        }}
      />
      <CardText>{t(option.hint)}</CardText>
      {visibility !== 'private' && (
        <View style={styles.actions}>
          <CopyLinkButton testID="folder-copy-link" link={lockerFolderLink(folder)} label={t('Copiar link da pasta')} />
        </View>
      )}
    </Card>
  );
}

/**
 * Copia um link público do Locker. Sem o código ainda (a pasta ou o arquivo não
 * chegou à nuvem), avisa em vez de copiar um link que não abriria.
 */
function CopyLinkButton({ link, label, testID }: { link: string | null; label: string; testID?: string }) {
  return (
    <Button
      testID={testID}
      label={label}
      variant="secondary"
      icon="compartilhar"
      onPress={() => {
        if (!link) {
          Alert.alert(t('Link ainda não disponível'), t('O link aparece quando o Locker sincronizar com a nuvem. Verifique a internet e tente de novo.'));
          return;
        }
        Clipboard.setString(link);
        Alert.alert(t('Link copiado'), link);
      }}
    />
  );
}

function NameInput({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <TextInput
      testID="files-name-input"
      style={styles.input}
      autoFocus
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      returnKeyType="done"
    />
  );
}

function SmallAction({ icon, label, onPress, danger }: { icon: 'editar' | 'mover' | 'lixeira'; label: string; onPress: () => void; danger?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.small, danger && styles.smallDanger, pressed && styles.pressed]} onPress={onPress}>
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.smallText, danger && styles.smallTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Thumb({ file, onPress }: { file: SavedFile; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable testID={`file-${file.id}`} accessibilityRole="button" accessibilityLabel={file.title} style={({ pressed }) => [styles.thumb, pressed && styles.pressed]} onPress={onPress}>
      {file.type === 'image' ? (
        <Image source={{ uri: file.url }} style={styles.thumbImage} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbImage, styles.video]}>
          <Icon name="video" size={28} color={colors.textSecondary} />
          {file.duration ? <Text style={styles.duration}>{file.duration}</Text> : null}
        </View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>
        {file.title}
      </Text>
    </Pressable>
  );
}

function MoveCard({
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
    <Card>
      <CardTitle>{title}</CardTitle>
      {targets.map(target => {
        const here = target.id === current;
        return (
          <Pressable
            key={target.id ?? 'root'}
            testID={`move-to-${target.id ?? 'root'}`}
            accessibilityRole="button"
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
      <Button label={t('Cancelar')} variant="secondary" onPress={onCancel} />
    </Card>
  );
}

function LinkForm({ onCancel, onSave }: { onCancel: () => void; onSave: (title: string, url: string, type: SavedFile['type']) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<SavedFile['type']>('image');
  const save = () => {
    const clean = normalizeUrl(url);
    if (!clean) {
      Alert.alert(t('Atenção'), t('O link não parece válido. Ex: https://seusite.com.br/foto.jpg'));
      return;
    }
    onSave(title.trim() || (type === 'image' ? t('Foto') : t('Vídeo')), clean, type);
  };
  return (
    <Card>
      <CardTitle>{t('Adicionar por link')}</CardTitle>
      <View style={styles.row}>
        {(['image', 'video'] as const).map(k => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: type === k }}
            style={[styles.choice, type === k && styles.choiceSelected]}
            onPress={() => setType(k)}>
            <Text style={[styles.choiceText, type === k && styles.choiceTextSelected]}>{k === 'image' ? t('Foto') : t('Vídeo')}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t('Nome')}</Text>
      <TextInput style={styles.input} placeholder={t('Opcional')} placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>{t('Link do arquivo')}</Text>
      <TextInput
        style={styles.input}
        placeholder="https://"
        placeholderTextColor={colors.textMuted}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={setUrl}
      />
      <CardText>{t('Use o link direto do arquivo para o teclado conseguir enviar a foto ou o vídeo.')}</CardText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label={t('Cancelar')} variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label={t('Salvar')} onPress={save} disabled={!url.trim()} />
        </View>
      </View>
    </Card>
  );
}

// ── Arquivo aberto: renomear, mover, excluir ────────────────────────────

function FileDetail({
  file,
  data,
  onBack,
  onChanged,
  onMoved,
}: {
  file: SavedFile;
  data: FilesData;
  onBack: () => void;
  onChanged: () => void;
  onMoved: (folderId: string | null) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [title, setTitle] = useState(file.title);
  const [moving, setMoving] = useState(false);
  const changed = title.trim() && title.trim() !== file.title;

  const remove = () =>
    Alert.alert(t('Excluir arquivo'), t('Excluir "{name}" do app e do teclado?', { name: file.title }), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'),
        style: 'destructive',
        onPress: () => {
          lockerDeleteFile(file.id);
          deleteUploadedMedia(file.storagePath);
          onChanged();
          onBack();
        },
      },
    ]);

  return (
    <Page>
      <SubHeader title={file.title} onBack={onBack} />
      {file.type === 'image' ? (
        <Image source={{ uri: file.url }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={[styles.preview, styles.video]}>
          <Icon name="video" size={40} color={colors.textSecondary} />
          {file.duration ? <Text style={styles.duration}>{file.duration}</Text> : null}
        </View>
      )}

      {moving ? (
        <MoveCard
          title={t('Mover para')}
          targets={moveTargets(data)}
          current={file.folderId}
          onCancel={() => setMoving(false)}
          onMove={to => {
            lockerSaveFile({ ...file, folderId: to });
            setMoving(false);
            onChanged();
            onMoved(to);
          }}
        />
      ) : (
        <Card>
          <Text style={styles.label}>{t('Nome')}</Text>
          <TextInput
            testID="file-title-input"
            style={styles.input}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          {changed ? (
            <Button
              testID="file-save-title"
              label={t('Salvar nome')}
              onPress={() => {
                lockerSaveFile({ ...file, title: title.trim() });
                onChanged();
                onBack();
              }}
            />
          ) : null}
          <CardText>{t('Em {folder}', { folder: moveTargets(data).find(m => m.id === file.folderId)?.label ?? LOCKER_NAME })}</CardText>
          <View style={styles.row}>
            <SmallAction icon="mover" label={t('Mover')} onPress={() => setMoving(true)} />
            <SmallAction icon="lixeira" label={t('Excluir')} danger onPress={remove} />
          </View>
          {/* Link permanente do Locker: quem tiver abre o arquivo sem login */}
          <CopyLinkButton testID="file-copy-link" link={lockerFileLink(file)} label={t('Copiar link do arquivo')} />
        </Card>
      )}
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  path: { fontSize: 13, color: colors.textMuted, marginTop: -spacing.md },
  actions: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: touchTarget,
    fontSize: 15,
  },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  smallDanger: { backgroundColor: colors.dangerBg },
  smallText: { fontSize: 14, fontWeight: '600', color: colors.text },
  smallTextDanger: { color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  thumb: { width: '30%', flexGrow: 1, maxWidth: '32%', gap: 4 },
  thumbImage: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbTitle: { fontSize: 12, color: colors.textSecondary },
  video: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  duration: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  moveRowHere: { backgroundColor: colors.primarySoft },
  moveText: { flex: 1, fontSize: 15, color: colors.text },
  moveTextHere: { color: colors.primaryText, fontWeight: '600' },
  moveHere: { fontSize: 12, color: colors.primaryText },
  choice: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  choiceSelected: { backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  choiceTextSelected: { color: colors.primaryText, fontWeight: '600' },
}));
