import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { IconTile } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { makeStyles, spacing, typography } from '../../keyboard/theme';
import type { SegmentProfile } from '../../segments/segments';
import { Button } from '../components/ui';
import { t } from '../../i18n';

interface Slide {
  icon: IconName;
  title: string;
  text: string;
}

/**
 * Cinco telas, uma ideia cada. Ativar o teclado não entra aqui: a tela de
 * ativação (KeyboardActivationScreen) vem logo depois do tutorial.
 */
function slidesFor(segment: SegmentProfile): Slide[] {
  const { catalog, item, items } = segment.terms;
  return [
    {
      icon: 'teclado',
      title: t('Bem-vindo ao KEYCON'),
      text: t('Seu catálogo de vendas dentro do teclado, em qualquer conversa.'),
    },
    {
      icon: 'novaPasta',
      title: t('Cadastre seus {items}', { items }),
      text: t('Crie pastas e adicione cada {item} com preço, fotos e vídeos.', { item }),
    },
    {
      icon: 'atalhos',
      title: t('Crie atalhos'),
      text: t('Textos, áudios e links que você manda sempre, prontos para enviar com um toque.'),
    },
    {
      icon: 'clientes',
      title: t('Clientes e agenda'),
      text: t('Acompanhe o funil e marque reuniões no app ou no teclado, que abre em tela grande.'),
    },
    {
      icon: 'arquivos',
      title: t('Venda pelo teclado'),
      text: t('Na conversa, toque em {catalog} no teclado e envie a ficha ou as fotos.', { catalog }),
    },
  ];
}

interface Props {
  segment: SegmentProfile;
  onClose: () => void;
}

export function TutorialScreen({ segment, onClose }: Props) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const slides = slidesFor(segment);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const scrollRef = useRef<Animated.FlatList<Slide> | null>(null);
  /** Posição do deslizar, em páginas (0 a 4, com frações no meio do gesto). */
  const scrollX = useRef(new Animated.Value(0)).current;

  // Girou a tela: fica na mesma página
  useEffect(() => {
    scrollRef.current?.scrollToOffset({ offset: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const goTo = (i: number) => {
    scrollRef.current?.scrollToOffset({ offset: i * width, animated: true });
    setIndex(i);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };

  return (
    <View style={styles.root} testID="tutorial">
      <View style={styles.top}>
        <Text style={styles.counter}>{t('{v} de {length}', { v: index + 1, length: slides.length })}</Text>
        {!last && (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Text style={styles.skip}>{t('Pular')}</Text>
          </Pressable>
        )}
      </View>

      {/* As páginas deslizam com o dedo; o ícone e o texto entram com um leve movimento */}
      <Animated.FlatList
        ref={scrollRef}
        style={styles.pager}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const lift = scrollX.interpolate({ inputRange: range, outputRange: [24, 0, 24], extrapolate: 'clamp' });
          const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.85, 1, 0.85], extrapolate: 'clamp' });
          return (
            <View style={[styles.slide, { width }]}>
              <Animated.View style={{ opacity, transform: [{ scale }] }}>
                <IconTile name={item.icon} size={96} />
              </Animated.View>
              <Animated.View style={[styles.copy, { opacity, transform: [{ translateY: lift }] }]}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.text}>{item.text}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={styles.dots}>
        {slides.map((_, i) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          // Ponto da página atual estica e acende acompanhando o dedo
          const grow = scrollX.interpolate({ inputRange: range, outputRange: [1, 3.3, 1], extrapolate: 'clamp' });
          const lit = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          return (
            <Pressable key={i} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${i + 1}`} onPress={() => goTo(i)}>
              <View style={styles.dotSlot}>
                <Animated.View style={[styles.dot, { transform: [{ scaleX: grow }] }]} />
                <Animated.View style={[styles.dot, styles.dotActive, { opacity: lit, transform: [{ scaleX: grow }] }]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        {index > 0 && (
          <View style={styles.flex}>
            <Button label={t('Voltar')} variant="secondary" onPress={() => goTo(index - 1)} />
          </View>
        )}
        <View style={styles.flex}>
          <Button testID="tutorial-next" label={last ? t('Começar') : t('Próximo')} onPress={() => (last ? onClose() : goTo(index + 1))} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.bg, paddingVertical: spacing.xl },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
  counter: { ...typography.caption, color: colors.textMuted },
  skip: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  pager: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl + spacing.sm },
  copy: { alignItems: 'center', gap: spacing.lg },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  text: { ...typography.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: spacing.xl },
  dotSlot: { width: 6, height: 6 },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt },
  dotActive: { backgroundColor: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
}));
