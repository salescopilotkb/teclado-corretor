/**
 * Prévia do teclado: como o Locker aparece no teclado e em que ordem. A pessoa
 * organiza aqui (setas ↑ ↓), tira itens do teclado e traz de volta. O mesmo vale
 * para o teclado e para o Locker web, sincronizado pela nuvem.
 *
 * No app as setas organizam (confiáveis no toque e acessíveis); no Locker web dá
 * para arrastar com o mouse.
 */
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { filesIn, folderPath, keyboardView, LOCKER_NAME, subfolders, withPositions } from '../../files/files';
import { lockerSaveFile, lockerSaveFolder } from '../../files/locker';
import { fileIcon, Icon } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { brand, makeStyles, radius, spacing, useColors } from '../../keyboard/theme';
import type { FileFolder, FilesData, SavedFile } from '../../types';
import { Card, CardText, CardTitle, Page, SubHeader } from '../components/ui';

/** Botões do menu do teclado, só para a moldura parecer o teclado de verdade. */
const MENU: Array<{ icon: IconName; label: string; active?: boolean }> = [
  { icon: 'teclado', label: 'ABC' },
  { icon: 'galeria', label: LOCKER_NAME, active: true },
  { icon: 'arquivos', label: 'Produtos' },
  { icon: 'atalhos', label: 'Atalhos' },
];

export function LockerKeyboardPreview({ data, onBack, onChanged }: { data: FilesData; onBack: () => void; onChanged: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  /** Pasta aberta na prévia (null = início do Locker no teclado). */
  const [level, setLevel] = useState<string | null>(null);

  const view = keyboardView(data);
  // A pasta aberta saiu do teclado (ou foi apagada): volta ao início
  const levelVisible = !level || view.folders.some(f => f.id === level);
  const at = levelVisible ? level : null;
  const folders = subfolders(view, at);
  const files = filesIn(view, at);
  const path = folderPath(view, at);
  // Fora do teclado neste nível (o app continua mostrando; o teclado não)
  const hiddenFolders = subfolders(data, at).filter(f => f.inKeyboard === false);
  const hiddenFiles = filesIn(data, at).filter(f => f.inKeyboard === false);

  /** Troca de lugar com o vizinho e grava as posições novas do nível. */
  function move<T extends FileFolder | SavedFile>(list: T[], index: number, delta: number, save: (item: T) => void) {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const ordered = [...list];
    [ordered[index], ordered[to]] = [ordered[to], ordered[index]];
    withPositions(ordered).forEach(save);
    onChanged();
  }
  const setFolderShown = (f: FileFolder, shown: boolean) => {
    lockerSaveFolder({ ...f, inKeyboard: shown });
    onChanged();
  };
  const setFileShown = (f: SavedFile, shown: boolean) => {
    lockerSaveFile({ ...f, inKeyboard: shown });
    onChanged();
  };

  return (
    <Page>
      <SubHeader title={t('Organizar o teclado')} subtitle={t('Como o Locker aparece no teclado')} onBack={onBack} />

      {/* Moldura do teclado: menu de cima + a aba Locker como ela fica */}
      <View style={styles.keyboard} testID="locker-keyboard-preview">
        <View style={styles.menu}>
          {MENU.map(m => (
            <View key={m.label} style={[styles.menuBtn, m.active && styles.menuBtnActive]}>
              <Icon name={m.icon} size={16} color={m.active ? brand.white : '#B9BFCC'} />
              <Text style={[styles.menuLabel, m.active && styles.menuLabelActive]} numberOfLines={1}>
                {m.active ? m.label : t(m.label)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.bar}>
          {at ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('Voltar')} hitSlop={8} style={styles.barBack} onPress={() => setLevel(path.length > 1 ? path[path.length - 2].id : null)}>
              <Icon name="voltar" size={18} color="#B9BFCC" />
              <Text style={styles.barTitle} numberOfLines={1}>
                {path[path.length - 1]?.name}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.barTitle}>{LOCKER_NAME}</Text>
          )}
        </View>

        {!folders.length && !files.length ? <Text style={styles.empty}>{t('Nada aqui no teclado.')}</Text> : null}
        {folders.map((f, i) => (
          <PreviewRow
            key={f.id}
            testID={`preview-folder-${f.id}`}
            icon="pasta"
            title={f.name}
            canUp={i > 0}
            canDown={i < folders.length - 1}
            onOpen={() => setLevel(f.id)}
            onUp={() => move(folders, i, -1, lockerSaveFolder)}
            onDown={() => move(folders, i, 1, lockerSaveFolder)}
            onHide={() => setFolderShown(f, false)}
          />
        ))}
        {files.map((f, i) => (
          <PreviewRow
            key={f.id}
            testID={`preview-file-${f.id}`}
            image={f.type === 'image' ? f.url : undefined}
            icon={fileIcon(f.type)}
            title={f.title}
            canUp={i > 0}
            canDown={i < files.length - 1}
            onUp={() => move(files, i, -1, lockerSaveFile)}
            onDown={() => move(files, i, 1, lockerSaveFile)}
            onHide={() => setFileShown(f, false)}
          />
        ))}
      </View>

      <CardText>{t('Toque numa pasta para organizar o que tem dentro. As setas mudam a ordem; o X tira do teclado (continua no Locker).')}</CardText>

      {hiddenFolders.length || hiddenFiles.length ? (
        <Card>
          <CardTitle>{t('Fora do teclado')}</CardTitle>
          <CardText>{t('Continuam no Locker do app e do navegador, mas não aparecem no teclado.')}</CardText>
          {hiddenFolders.map(f => (
            <HiddenRow key={f.id} icon="pasta" title={f.name} onShow={() => setFolderShown(f, true)} />
          ))}
          {hiddenFiles.map(f => (
            <HiddenRow key={f.id} icon={fileIcon(f.type)} title={f.title} onShow={() => setFileShown(f, true)} />
          ))}
        </Card>
      ) : null}
      <View style={{ height: colors.glass ? spacing.lg : 0 }} />
    </Page>
  );
}

/** Uma linha da prévia: como no teclado, com ↑ ↓ e o X para tirar. */
function PreviewRow({
  icon,
  image,
  title,
  canUp,
  canDown,
  onOpen,
  onUp,
  onDown,
  onHide,
  testID,
}: {
  icon: IconName;
  image?: string;
  title: string;
  canUp: boolean;
  canDown: boolean;
  onOpen?: () => void;
  onUp: () => void;
  onDown: () => void;
  onHide: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row} testID={testID}>
      <Pressable style={styles.rowMain} disabled={!onOpen} onPress={onOpen} accessibilityRole={onOpen ? 'button' : undefined}>
        {image ? <Image source={{ uri: image }} style={styles.rowThumb} /> : <Icon name={icon} size={20} color="#FFB4A3" />}
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {onOpen ? <Icon name="avancar" size={16} color="#8C93A1" /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Subir')} hitSlop={4} disabled={!canUp} style={[styles.arrow, !canUp && styles.off]} onPress={onUp}>
        <Text style={styles.arrowText}>↑</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Descer')} hitSlop={4} disabled={!canDown} style={[styles.arrow, !canDown && styles.off]} onPress={onDown}>
        <Text style={styles.arrowText}>↓</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Tirar do teclado')} hitSlop={4} style={styles.arrow} onPress={onHide}>
        <Icon name="fechar" size={14} color="#B9BFCC" />
      </Pressable>
    </View>
  );
}

function HiddenRow({ icon, title, onShow }: { icon: IconName; title: string; onShow: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.hiddenRow}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.hiddenTitle} numberOfLines={1}>
        {title}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={6} style={styles.showBtn} onPress={onShow}>
        <Icon name="adicionar" size={14} color={colors.primaryText} />
        <Text style={styles.showText}>{t('Mostrar no teclado')}</Text>
      </Pressable>
    </View>
  );
}

// A moldura usa as cores do teclado (grafite), em qualquer tema do app
const useStyles = makeStyles(colors => ({
  keyboard: {
    backgroundColor: brand.graphite,
    borderRadius: radius.lg,
    paddingBottom: spacing.sm,
    minHeight: 300,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  menu: { flexDirection: 'row', gap: 4, padding: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  menuBtn: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, borderRadius: radius.sm },
  menuBtnActive: { backgroundColor: brand.coral },
  menuLabel: { fontSize: 10, color: '#B9BFCC' },
  menuLabelActive: { color: brand.white, fontWeight: '600' },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: spacing.sm },
  barBack: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  barTitle: { fontSize: 15, fontWeight: '600', color: '#F5F6F8', flexShrink: 1 },
  empty: { color: '#8C93A1', fontSize: 13, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: spacing.sm,
    marginTop: 6,
    paddingRight: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 46, paddingHorizontal: spacing.sm },
  rowThumb: { width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  rowTitle: { flex: 1, fontSize: 14, color: '#F5F6F8' },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  arrowText: { fontSize: 16, fontWeight: '700', color: '#F5F6F8' },
  off: { opacity: 0.3 },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  hiddenTitle: { flex: 1, fontSize: 14, color: colors.textSecondary },
  showBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  showText: { fontSize: 12, fontWeight: '600', color: colors.primaryText },
}));
