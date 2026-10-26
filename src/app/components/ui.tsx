/**
 * Peças de tela do app (não do teclado), para todas as páginas seguirem o
 * mesmo padrão do manual: cards no surface, botão principal coral, botão
 * secundário neutro, um título por tela e margens de 16 (zona neutra).
 */
import React from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { CoralSheen } from '../../keyboard/components/Glass';
import { Icon, IconTile } from '../../keyboard/components/Icon';
import type { IconName } from '../../keyboard/components/Icon';
import { coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import type { Palette } from '../../keyboard/theme';
import { t } from '../../i18n';
import { useAppBack } from '../../navigation/back';

/** Vidro do card: raio maior, contorno com luz em cima e sombra em duas alturas (só iOS/web). */
const GLASS_RADIUS = 24;
function glassShadow(colors: Palette) {
  if (!colors.glass) return {};
  return {
    shadowColor: '#000',
    shadowOpacity: colors.scheme === 'dark' ? 0.3 : 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  };
}

/** Reflexo dos botões coral (o mesmo do teclado). */
export { CoralSheen };

/** Página rolável com a margem padrão. */
export function Page({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

/** Título da tela: sobrelinha opcional + título + uma linha de apoio. */
export function ScreenTitle({ overline, title, subtitle }: { overline?: string; title: string; subtitle?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.titleBlock}>
      {overline ? <Text style={styles.overline}>{overline}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Cabeçalho de submenu: voltar + título. O "voltar" do celular faz o mesmo. */
export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  useAppBack(onBack);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('Voltar')} style={styles.subHeader} onPress={onBack} hitSlop={8}>
      <Icon name="voltar" size={20} color={colors.textMuted} />
      <Text style={styles.subHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Título de seção dentro de um card. */
export function CardTitle({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.cardTitle}>{children}</Text>;
}

export function CardText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.cardText}>{children}</Text>;
}

interface MenuRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Valor à direita (ex.: "Escuro", "3 de 6"). */
  value?: string;
  onPress: () => void;
  testID?: string;
}

/** Linha de menu: ícone, título, apoio e seta. Use várias dentro de um MenuGroup. */
export function MenuRow({ icon, title, subtitle, value, onPress, testID }: MenuRowProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <IconTile name={icon} size={40} />
      <View style={styles.menuInfo}>
        <Text style={styles.menuTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.menuSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      <Icon name="avancar" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Card com linhas de menu separadas por divisórias. */
export function MenuGroup({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.menuGroup}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.menuDivider} />}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = coral (ação principal), secondary = neutro, danger = sair/excluir. */
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, testID }: ButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && variant === 'primary' && styles.buttonPrimaryPressed,
        pressed && variant !== 'primary' && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}>
      {variant === 'primary' ? <CoralSheen /> : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }, variant === 'primary' && onCoralText]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Estado vazio: ícone, uma frase e (opcional) a ação para sair dele. */
export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <IconTile name={icon} size={56} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <Button label={actionLabel} onPress={onAction} icon="adicionar" />
        </View>
      ) : null}
    </View>
  );
}

/** Selo de status: verde (pronto) ou neutro (pendente). */
export function StatusChip({ done, label }: { done: boolean; label: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.chip, done ? styles.chipDone : styles.chipPending]}>
      <Icon name={done ? 'check' : 'info'} size={14} color={done ? colors.successText : colors.textMuted} />
      <Text style={[styles.chipText, done && styles.chipTextDone]}>{label}</Text>
    </View>
  );
}

/** Barra de progresso fina (coral). */
export function ProgressBar({ value }: { value: number }) {
  const styles = useStyles();
  const pct = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` as const;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: pct }]} />
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  titleBlock: { gap: spacing.xs, paddingTop: spacing.xs },
  overline: { ...typography.overline, color: colors.primaryText },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget,
    alignSelf: 'flex-start',
  },
  subHeaderTitle: { ...typography.title, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: colors.glass ? GLASS_RADIUS : radius.xl,
    padding: colors.glass ? 20 : spacing.lg,
    gap: spacing.md,
    ...glassBorder(colors),
    ...glassShadow(colors),
  },
  cardTitle: { ...typography.title, color: colors.text },
  cardText: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: colors.glass ? GLASS_RADIUS : radius.xl,
    overflow: 'hidden',
    ...glassBorder(colors),
  },
  menuDivider: { height: 1, backgroundColor: colors.divider, marginLeft: spacing.lg + 40 + spacing.md },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  menuSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  menuValue: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  pressed: { opacity: 0.7 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.xl,
    // Vidro: botões em pílula
    borderRadius: colors.glass ? radius.pill : radius.md,
  },
  // Coral sólido (nunca translúcido: o texto branco precisa do coral cheio atrás)
  buttonPrimary: {
    backgroundColor: colors.primary,
    ...coralGlass(colors),
  },
  buttonPrimaryPressed: { backgroundColor: colors.primaryStrong },
  buttonSecondary: { backgroundColor: colors.surfaceAlt, ...glassBorder(colors) },
  buttonDanger: { backgroundColor: colors.dangerBg },
  buttonText: { ...typography.button },
  disabled: { opacity: 0.5 },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { ...typography.title, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
  emptyAction: { marginTop: spacing.md, alignSelf: 'stretch' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipDone: { backgroundColor: colors.successBg },
  chipPending: { backgroundColor: colors.surfaceAlt },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextDone: { color: colors.successText },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
}));
