import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

/** Um assunto por tela, com no máximo duas frases. */
function slidesFor(segment: SegmentProfile): Slide[] {
  const { catalog, item, items } = segment.terms;
  return [
    {
      icon: 'teclado',
      title: t('Bem-vindo ao KEYCON'),
      text: t('Seu catálogo de vendas dentro do teclado, em qualquer conversa.'),
    },
    {
      icon: 'configuracoes',
      title: t('Ative o teclado'),
      text: t('Ligue o KEYCON nas configurações do celular. Leva menos de um minuto.'),
    },
    {
      icon: 'novaPasta',
      title: t('Cadastre seus {items}', { items }),
      text: t('Crie pastas e adicione cada {item} com preço, fotos e vídeos.', { item }),
    },
    {
      icon: 'atalhos',
      title: t('Crie atalhos'),
      text: t('Salve os textos, áudios e links que você manda sempre e envie com um toque, pelo app ou pelo próprio teclado.'),
    },
    {
      icon: 'arquivos',
      title: t('Venda pelo teclado'),
      text: t('Na conversa, toque em {catalog} no teclado e envie a ficha ou as fotos.', { catalog }),
    },
    {
      icon: 'galeria',
      title: t('Seus arquivos'),
      text: t('Organize fotos e vídeos em pastas e subpastas, pelo app ou pelo próprio teclado, e envie na conversa.'),
    },
    {
      icon: 'clientes',
      title: t('Clientes e agenda'),
      text: t('Acompanhe o funil e marque reuniões no app ou no teclado, que abre em tela grande.'),
    },
    // "Respostas com IA" volta quando a IA sair do modo de demonstração
    {
      icon: 'respostas',
      title: t('Para o dia a dia'),
      text: t(
        'Deixe o KEYCON como teclado padrão do celular: ele corrige palavras, sugere as próximas e coloca maiúscula sozinho em qualquer app. O ícone de teclado no topo alterna entre as letras e as suas ferramentas de venda.',
      ),
    },
  ];
}

interface Props {
  segment: SegmentProfile;
  onClose: () => void;
}

export function TutorialScreen({ segment, onClose }: Props) {
  const styles = useStyles();
  const slides = slidesFor(segment);
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const last = index === slides.length - 1;

  return (
    <View style={styles.root} testID="tutorial">
      <View style={styles.top}>
        <Text style={styles.counter}>
          {t('{v} de {length}', { v: index + 1, length: slides.length })}
        </Text>
        {!last && (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Text style={styles.skip}>{t('Pular')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <IconTile name={slide.icon} size={96} />
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {index > 0 && (
          <View style={styles.flex}>
            <Button label={t('Voltar')} variant="secondary" onPress={() => setIndex(i => i - 1)} />
          </View>
        )}
        <View style={styles.flex}>
          <Button
            testID="tutorial-next"
            label={last ? t('Começar') : t('Próximo')}
            onPress={() => (last ? onClose() : setIndex(i => i + 1))}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  counter: { ...typography.caption, color: colors.textMuted },
  skip: { fontSize: 15, fontWeight: '600', color: colors.primaryText },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  text: { ...typography.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt },
  dotActive: { width: 20, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
}));
