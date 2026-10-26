import { t } from '../../i18n';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { MoreSubMenu, ThemePreference } from '../../types';
import { glassBorder, makeStyles, radius, spacing, touchTarget, useColors } from '../theme';
import { AICopilotTab } from './AICopilotTab';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { Icon, IconTile } from './Icon';

const THEME_LABEL: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
};

interface Props {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onInsert: (text: string) => void;
}

/**
 * Aba "Mais" — IA (respostas sugeridas), Configurações e Diagnóstico.
 * Agenda e CRM têm botões próprios no menu do teclado.
 */
export function MoreTab({ theme, onThemeChange, onInsert }: Props) {
  const colors = useColors();
  const styles = useStyles();

  const backBar = (title: string) => (
    <Pressable onPress={() => setSelectedSubMenu(null)} style={styles.breadcrumb}>
      <Icon name="voltar" size={18} color={colors.textMuted} />
      <Text style={styles.back}>{t('Voltar')}</Text>
      <Text style={styles.crumbTitle}>{title}</Text>
    </Pressable>
  );
  const [selectedSubMenu, setSelectedSubMenu] = useState<MoreSubMenu>(null);

  // Se nenhum submenu estiver aberto, exibe as opções do segundo menu
  if (!selectedSubMenu) {
    return (
      <ScrollView contentContainerStyle={styles.menuContainer} keyboardShouldPersistTaps="always">
        <Pressable
          testID="more-btn-copilot"
          style={styles.menuOption}
          onPress={() => setSelectedSubMenu('copilot')}>
          <IconTile name="ia" size={36} />
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>{t('IA')}</Text>
            <Text style={styles.menuSubtitle}>{t('Respostas sugeridas para a mensagem do cliente')}</Text>
          </View>
        </Pressable>

        <Pressable
          testID="more-btn-settings"
          style={styles.menuOption}
          onPress={() => setSelectedSubMenu('settings')}>
          <IconTile name="configuracoes" size={36} />
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>{t('Configurações')}</Text>
            <Text style={styles.menuSubtitle}>{t('Aparência do teclado (Claro, Escuro ou Padrão)')}</Text>
          </View>
          <Text style={styles.menuMeta}>{t(THEME_LABEL[theme]).toUpperCase()}</Text>
        </Pressable>

        <Pressable
          testID="more-btn-diagnostics"
          style={styles.menuOption}
          onPress={() => setSelectedSubMenu('diagnostics')}>
          <IconTile name="dados" size={36} />
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>{t('Diagnóstico')}</Text>
            <Text style={styles.menuSubtitle}>{t('O que o campo em foco aceita: texto, fotos, GIFs')}</Text>
          </View>
        </Pressable>

        <Text style={styles.tip}>{t('Dica: segure um botão do menu por 1 segundo e arraste para o lado para mudar a ordem.')}</Text>
      </ScrollView>
    );
  }

  // 1. IA: sugestões de resposta para a mensagem copiada do cliente
  if (selectedSubMenu === 'copilot') {
    return (
      <View style={styles.flex}>
        {backBar(t('IA'))}
        <AICopilotTab onInsert={onInsert} />
      </View>
    );
  }

  // 2. SUBMENU: DIAGNÓSTICO (formatos aceitos pelo campo em foco)
  if (selectedSubMenu === 'diagnostics') {
    return (
      <View style={styles.flex}>
        {backBar(t('Diagnóstico'))}
        <DiagnosticsPanel onInsert={onInsert} />
      </View>
    );
  }

  // 3. SUBMENU: CONFIGURAÇÕES (APARÊNCIA DO TECLADO)
  return (
    <View style={styles.flex}>
      {backBar(t('Aparência do Teclado'))}

      <ScrollView contentContainerStyle={styles.themeOptionsContainer} keyboardShouldPersistTaps="always">
        <Text style={styles.themeSectionTitle}>{t('Tema da Interface')}</Text>

        {(
          [
            { key: 'light', label: t('Modo Claro') },
            { key: 'dark', label: t('Modo Escuro') },
            { key: 'system', label: t('Padrão do Sistema') },
          ] as const
        ).map(opt => {
          const isSelected = theme === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.themeOptionRow, isSelected && styles.themeOptionRowActive]}
              onPress={() => onThemeChange(opt.key)}>
              <Text style={[styles.themeOptionText, isSelected && styles.themeOptionTextActive]}>
                {opt.label}
              </Text>
              {isSelected && <Icon name="check" size={18} color={colors.primaryText} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  list: { padding: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
  menuContainer: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.md,
    borderRadius: radius.md,
  },
  menuInfo: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  tip: { fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.md, marginTop: spacing.xs },
  menuMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
  },
  back: { color: colors.textMuted, fontWeight: '600', fontSize: 13, marginRight: spacing.sm },
  crumbTitle: { color: colors.text, fontWeight: '600', fontSize: 15, flex: 1 },
  themeOptionsContainer: {
    padding: spacing.md,
    gap: 10,
  },
  themeSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  themeOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  themeOptionRowActive: {
    backgroundColor: colors.primarySoft,
  },
  themeOptionText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  themeOptionTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
}));
