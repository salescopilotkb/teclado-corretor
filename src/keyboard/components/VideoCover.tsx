/**
 * Capa do vídeo no Locker (app e teclado): um quadro do vídeo com o selo de play
 * e a duração. Enquanto a capa não fica pronta (ou se não der para gerar), mostra
 * o ícone de vídeo, como antes.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { videoThumbnail } from '../../native/VideoThumb';
import type { SavedFile } from '../../types';
import { makeStyles, useColors } from '../theme';
import { Icon } from './Icon';

/** Capas já prontas nesta abertura: voltar à pasta não pisca o ícone. */
const ready = new Map<string, string>();

const keyOf = (file: SavedFile) => file.storagePath || file.id;

/** Capa do vídeo (file://... ou data:...), ou null enquanto não há. */
export function useVideoThumb(file: SavedFile | undefined): string | null {
  const isVideo = file?.type === 'video';
  const key = file ? keyOf(file) : '';
  const [uri, setUri] = useState<string | null>(() => (isVideo ? ready.get(key) ?? null : null));
  useEffect(() => {
    if (!isVideo || !file?.url) return;
    const known = ready.get(key);
    if (known) {
      setUri(known);
      return;
    }
    let alive = true;
    videoThumbnail(file.url, key).then(thumb => {
      if (!thumb) return;
      ready.set(key, thumb);
      if (alive) setUri(thumb);
    });
    return () => {
      alive = false;
    };
  }, [isVideo, key, file?.url]);
  return isVideo ? uri : null;
}

interface Props {
  file: SavedFile;
  /** Tamanho e cantos da caixa (a mesma das fotos ao lado). */
  style: StyleProp<ViewStyle>;
  /** Ícone de vídeo enquanto não há capa. */
  iconSize: number;
  /** Selo de play: maior na tela do arquivo, menor na grade. */
  playSize?: number;
}

export function VideoCover({ file, style, iconSize, playSize = 28 }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const thumb = useVideoThumb(file);
  return (
    <View style={[style, styles.box]}>
      {thumb ? (
        <>
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[styles.play, { width: playSize, height: playSize, borderRadius: playSize / 2 }]}>
            <Svg width={playSize * 0.5} height={playSize * 0.5} viewBox="0 0 24 24">
              <Path d="M8 5.5v13l11-6.5z" fill="#FFFFFF" />
            </Svg>
          </View>
          {file.duration ? (
            <View style={styles.durationPill}>
              <Text style={styles.durationOnThumb}>{file.duration}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Icon name="video" size={iconSize} color={colors.textSecondary} />
          {file.duration ? <Text style={styles.duration}>{file.duration}</Text> : null}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 4 },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingLeft: 2,
  },
  durationPill: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationOnThumb: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  duration: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
}));
