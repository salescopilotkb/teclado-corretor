/**
 * Botões das telas de gestão do teclado (Produtos e Arquivos): ícone na barra
 * de cima, ações (Editar, Mover, Excluir) e a confirmação de excluir, que
 * aparece na própria tela (o teclado não pode abrir janelas de aviso).
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, useColors } from '../theme';
import { CoralSheen } from './Glass';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function BarButton({
  icon,
  label,
  onPress,
  primary,
  disabled,
  showLabel,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** Mostra o texto ao lado do ícone (ex.: "+ Novo produto"), para a ação principal ficar clara. */
  showLabel?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const color = primary ? colors.onPrimary : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.barBtn,
        showLabel && styles.barBtnLabeled,
        primary && styles.barBtnPrimary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {primary && <CoralSheen radius={radius.sm} />}
      <Icon name={icon} size={showLabel ? 18 : 20} color={color} />
      {showLabel && (
        <Text style={[styles.barBtnText, primary && onCoralText, { color }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ActionButton({
  icon,
  label,
  onPress,
  danger,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [styles.action, danger && styles.actionDanger, pressed && styles.pressed, disabled && styles.disabled]}
      onPress={onPress}>
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * "Usar": envia o item direto para a conversa, sem abrir (Arquivos, Produtos
 * e Atalhos). Botão coral pequeno; o toque nele não abre o item. `label`
 * troca o texto (ex.: "Conversar" no CRM).
 */
export function UseButton({
  onPress,
  onLongPress,
  testID,
  compact,
  label,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
  compact?: boolean;
  label?: string;
}) {
  const styles = useStyles();
  const text = label ?? t('Usar');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text}
      hitSlop={6}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.use, compact && styles.useCompact, pressed && styles.pressed]}>
      <CoralSheen radius={radius.pill} />
      <Text style={[styles.useText, onCoralText]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

/** "Excluir …?" com Cancelar / Excluir, no lugar dos botões. */
/**
 * No iPhone a Apple não deixa o teclado abrir a galeria, a câmera nem o
 * microfone: no lugar dos botões, diz para fazer pelo app (aparece aqui na hora).
 */
export function AppOnlyNote({ text, testID }: { text: string; testID?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.appOnly} testID={testID ?? 'app-only-note'}>
      <Icon name="info" size={16} color={colors.textMuted} />
      <Text style={styles.appOnlyText}>{text}</Text>
    </View>
  );
}

export function ConfirmDelete({ message, onCancel, onConfirm, testID }: { message: string; onCancel: () => void; onConfirm: () => void; testID?: string }) {
  return <ConfirmBox message={message} onCancel={onCancel} onConfirm={onConfirm} testID={testID} confirmLabel={t('Excluir')} confirmIcon="lixeira" danger />;
}

/** Pergunta na própria tela (o teclado não pode abrir janelas de aviso). */
export function ConfirmBox({
  message,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmIcon,
  danger,
  testID,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmIcon: IconName;
  danger?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmText}>{message}</Text>
      <View style={styles.row}>
        <ActionButton testID={testID ? `${testID}-cancel` : undefined} icon="fechar" label={t('Cancelar')} onPress={onCancel} />
        <ActionButton testID={testID} icon={confirmIcon} label={confirmLabel} danger={danger} onPress={onConfirm} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', gap: spacing.sm },
  barBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  barBtnPrimary: { backgroundColor: colors.primary, ...coralGlass(colors, { pill: false }) },
  barBtnLabeled: { width: 'auto', flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm + 2, flexShrink: 0 },
  barBtnText: { fontSize: 13, fontWeight: '600' },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  actionDanger: { backgroundColor: colors.dangerBg },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.text },
  actionTextDanger: { color: colors.danger },
  use: {
    minHeight: 30,
    minWidth: 58,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...coralGlass(colors, { pill: true }),
  },
  /** Embaixo das miniaturas (Arquivos): ocupa a largura da miniatura. */
  useCompact: { minHeight: 26, minWidth: 0, paddingHorizontal: spacing.sm },
  useText: { fontSize: 13, fontWeight: '700', color: colors.onPrimary },
  confirm: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, ...glassBorder(colors) },
  confirmText: { fontSize: 13, lineHeight: 18, color: colors.text },
  appOnly: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
  },
  appOnlyText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textMuted },
}));
