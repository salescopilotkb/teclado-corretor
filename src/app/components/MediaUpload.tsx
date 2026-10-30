/**
 * Adicionar fotos, vídeos e áudios no app: botões de origem (galeria, câmera,
 * link) e o andamento do envio para a nuvem.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Icon } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { glassBorder, makeStyles, radius, spacing, useColors } from '../../keyboard/theme';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { PickError } from '../../native/MediaPicker';
import { UploadError, uploadMedia } from '../../services/mediaUpload';
import type { LocalMedia, UploadedMedia } from '../../services/mediaUpload';
import { t } from '../../i18n';

export interface SourceOption {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** Fileira de botões de origem ("Galeria", "Câmera", "Link"...). */
export function SourceButtons({ options, disabled }: { options: SourceOption[]; disabled?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.sources}>
      {options.map(o => (
        <Pressable
          key={o.key}
          testID={`source-${o.key}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={o.onPress}
          style={({ pressed }) => [styles.source, pressed && styles.pressed, disabled && styles.disabled]}>
          <Icon name={o.icon} size={18} color={colors.text} />
          <Text style={styles.sourceText}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface UploadState {
  name: string;
  progress: number;
}

/**
 * Envio com andamento. `run(pegar, aoTerminar)` abre o seletor, envia o arquivo
 * e chama aoTerminar com o link; erros viram a mensagem `error`.
 */
export function useUploader() {
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async (
      pick: () => Promise<LocalMedia | null>,
      onDone: (uploaded: UploadedMedia, media: LocalMedia) => void,
      /** Para onde vai (padrão: bucket "media"; Arquivos usa o Locker, no R2). */
      upload: typeof uploadMedia = uploadMedia,
    ) => {
      if (busy.current) return;
      busy.current = true;
      setError(null);
      KeyboardBridge.setMediaUploading?.(true);
      try {
        const media = await pick();
        if (!media) return;
        setUploading({ name: media.name, progress: 0 });
        const uploaded = await upload(media, progress => setUploading({ name: media.name, progress }));
        onDone(uploaded, media);
      } catch (e) {
        // t(): as mensagens do Android (galeria do teclado) chegam em português
        setError(
          e instanceof UploadError || e instanceof PickError || e instanceof Error
            ? t(e.message)
            : t('Não foi possível enviar o arquivo.'),
        );
      } finally {
        busy.current = false;
        setUploading(null);
        KeyboardBridge.setMediaUploading?.(false);
      }
    },
    [],
  );

  return { run, uploading, error, clearError: () => setError(null) };
}

/** Faixa de "Enviando… 45%" e mensagem de erro. */
export function UploadStatus({ uploading, error }: { uploading: UploadState | null; error: string | null }) {
  const colors = useColors();
  const styles = useStyles();
  if (uploading) {
    const pct = Math.round(uploading.progress * 100);
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.primaryText} />
        <View style={styles.flex}>
          <Text style={styles.statusTitle} numberOfLines={1}>
            {t('Enviando {name}', { name: uploading.name })}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(4, pct)}%` }]} />
          </View>
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.status, styles.statusError]} accessibilityLiveRegion="polite">
        <Icon name="info" size={18} color={colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return null;
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1, gap: 6 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder(colors),
  },
  sourceText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  statusError: { backgroundColor: colors.dangerBg },
  statusTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  pct: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.danger },
}));
