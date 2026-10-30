import { LANGUAGES, t } from '../../i18n';
import { useKeyboardBack } from '../../navigation/back';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { COUNTRIES, CURRENCIES, deduceFromMarketId, resolveMarketId, TARGET_AUDIENCES } from '../../i18n/markets';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { getSegment, SEGMENTS } from '../../segments/segments';
import type { MoreSubMenu, SellerProfile, ThemePreference } from '../../types';
import { glassBorder, makeStyles, radius, spacing, touchTarget, useColors } from '../theme';
import { Icon, IconTile } from './Icon';
import { ResizeHandle } from './ResizeHandle';

const THEME_LABEL: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
};

const THEME_OPTIONS = [
  { key: 'light', label: 'Modo Claro' },
  { key: 'dark', label: 'Modo Escuro' },
  { key: 'system', label: 'Padrão do Sistema' },
] as const;

/** Telas dentro de Configurações. */
type SettingsScreen = 'root' | 'theme' | 'segment' | 'language' | 'market';

interface Props {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  seller: SellerProfile;
  /** Salva o perfil (aparelho e nuvem) e recarrega o teclado. */
  onProfileChange: (profile: SellerProfile) => void;
  onExpandedChange: (expanded: boolean) => void;
  /** A barrinha de puxar passou da altura mínima: volta ao teclado de letras. */
  onCollapse?: () => void;
}

/**
 * Aba "Mais" — Configurações (a IA saiu por enquanto: ver IMPLEMENTACOES-FUTURAS.md).
 * Agenda e CRM têm botões próprios no menu do teclado.
 */
export function MoreTab({ theme, onThemeChange, seller, onProfileChange, onExpandedChange, onCollapse }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [selectedSubMenu, setSelectedSubMenu] = useState<MoreSubMenu>(null);
  const [settings, setSettings] = useState<SettingsScreen>('root');
  // Em Configurações, o "voltar" do celular volta uma tela
  useKeyboardBack(() => (settings !== 'root' ? setSettings('root') : setSelectedSubMenu(null)), selectedSubMenu !== null);

  // Configurações: listas longas (ramos, países), o teclado abre em tela grande
  const big = selectedSubMenu === 'settings';
  useEffect(() => {
    onExpandedChange(big);
    if (!big) return;
    // Fechou e reabriu o teclado: o Android volta ao tamanho normal, pede de novo
    return KeyboardBridge.onKeyboardShow(() => onExpandedChange(true));
  }, [big, onExpandedChange]);
  useEffect(() => () => onExpandedChange(false), [onExpandedChange]);

  const backBar = (title: string, onBack: () => void) => (
    <Pressable onPress={onBack} style={styles.breadcrumb}>
      <Icon name="voltar" size={18} color={colors.textMuted} />
      <Text style={styles.back}>{t('Voltar')}</Text>
      <Text style={styles.crumbTitle} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );

  // Se nenhum submenu estiver aberto, exibe as opções do segundo menu
  if (!selectedSubMenu) {
    return (
      <ScrollView contentContainerStyle={styles.menuContainer} keyboardShouldPersistTaps="always">
        <Pressable
          testID="more-btn-settings"
          style={styles.menuOption}
          onPress={() => {
            setSettings('root');
            setSelectedSubMenu('settings');
          }}>
          <IconTile name="configuracoes" size={36} />
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>{t('Configurações')}</Text>
            <Text style={styles.menuSubtitle}>{t('Tema, ramo do negócio, idioma e onde você vende')}</Text>
          </View>
        </Pressable>

        <Text style={styles.tip}>{t('Dica: segure um botão do menu por 1 segundo e arraste para o lado para mudar a ordem.')}</Text>
      </ScrollView>
    );
  }

  // Barrinha no topo de todas as telas de Configurações (no mesmo lugar: não recomeça ao trocar de tela)
  const handle = onCollapse ? <ResizeHandle id="settings" onCollapse={onCollapse} /> : null;

  // CONFIGURAÇÕES — as mesmas do app (tela Conta), salvas no aparelho e na nuvem
  const toRoot = () => setSettings('root');
  const segment = getSegment(seller.segment);
  const language = seller.language ?? 'pt';
  const deduced = deduceFromMarketId(seller.market);
  const country = seller.country ?? deduced.country;
  const currency = seller.currency ?? deduced.currency;
  const audience = seller.targetAudience ?? deduced.targetAudience;

  /** País, moeda ou público mudou: recalcula o mercado (moeda dos preços, idioma das mensagens). */
  const saveMarket = (next: { country: typeof country; currency: typeof currency; targetAudience: typeof audience }) =>
    onProfileChange({ ...seller, ...next, market: resolveMarketId(next.country, next.currency, next.targetAudience) });

  if (settings === 'theme') {
    return (
      <View style={styles.flex}>
        {handle}
        {backBar(t('Tema da Interface'), toRoot)}
        <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="always">
          {THEME_OPTIONS.map(opt => (
            <OptionRow key={opt.key} label={t(opt.label)} selected={theme === opt.key} onPress={() => onThemeChange(opt.key)} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (settings === 'segment') {
    return (
      <View style={styles.flex}>
        {handle}
        {backBar(t('Ramo do negócio'), toRoot)}
        <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="always">
          {SEGMENTS.map(s => {
            const item = getSegment(s.id);
            return (
              <OptionRow
                key={s.id}
                testID={`kb-segment-${s.id}`}
                icon={item.icon}
                label={item.label}
                description={item.description}
                selected={seller.segment === s.id}
                onPress={() => onProfileChange({ ...seller, segment: s.id })}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (settings === 'language') {
    return (
      <View style={styles.flex}>
        {handle}
        {backBar(t('Idioma do app'), toRoot)}
        <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="always">
          {LANGUAGES.map(l => (
            <OptionRow
              key={l.id}
              testID={`kb-language-${l.id}`}
              label={l.label}
              selected={language === l.id}
              onPress={() => onProfileChange({ ...seller, language: l.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (settings === 'market') {
    return (
      <View style={styles.flex}>
        {handle}
        {backBar(t('Onde você vende?'), toRoot)}
        <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="always">
          <Text style={styles.sectionTitle}>{t('1. País onde você opera')}</Text>
          {COUNTRIES.map(c => (
            <OptionRow
              key={c.id}
              testID={`kb-country-${c.id}`}
              label={`${c.flag} ${t(c.name)}`}
              selected={country === c.id}
              // Trocar o país já sugere a moeda e o público dele (como no app)
              onPress={() => saveMarket({ country: c.id, currency: c.defaultCurrency, targetAudience: c.defaultAudience })}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('2. Moeda das suas vendas')}</Text>
          {CURRENCIES.map(c => (
            <OptionRow
              key={c.id}
              testID={`kb-currency-${c.id}`}
              label={`${c.symbol}  ${t(c.label)}`}
              selected={currency === c.id}
              onPress={() => saveMarket({ country, currency: c.id, targetAudience: audience })}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('3. Para quem você vende?')}</Text>
          {TARGET_AUDIENCES.map(a => (
            <OptionRow
              key={a.id}
              testID={`kb-audience-${a.id}`}
              label={`${a.flag} ${t(a.label)}`}
              description={t(a.languageLabel)}
              selected={audience === a.id}
              onPress={() => saveMarket({ country, currency, targetAudience: a.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  const countryInfo = COUNTRIES.find(c => c.id === country) ?? COUNTRIES[0];
  return (
    <View style={styles.flex}>
      {handle}
      {backBar(t('Configurações'), () => setSelectedSubMenu(null))}
      <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="always">
        <SettingRow testID="kb-settings-theme" title={t('Tema da Interface')} value={t(THEME_LABEL[theme])} onPress={() => setSettings('theme')} />
        <SettingRow testID="kb-settings-segment" title={t('Ramo do negócio')} value={segment.label} onPress={() => setSettings('segment')} />
        <SettingRow
          testID="kb-settings-language"
          title={t('Idioma do app')}
          value={LANGUAGES.find(l => l.id === language)?.label ?? ''}
          onPress={() => setSettings('language')}
        />
        <SettingRow
          testID="kb-settings-market"
          title={t('Onde você vende?')}
          value={`${countryInfo.flag} ${t(countryInfo.name)} · ${currency}`}
          onPress={() => setSettings('market')}
        />
      </ScrollView>
    </View>
  );
}

/** Linha de Configurações: o nome, o valor atual e a seta. */
function SettingRow({ title, value, onPress, testID }: { title: string; value: string; onPress: () => void; testID?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable testID={testID} accessibilityRole="button" style={styles.settingRow} onPress={onPress}>
      <View style={styles.flex}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Icon name="avancar" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Uma escolha da lista (com ✓ na atual): salva na hora, como o tema. */
function OptionRow({
  label,
  description,
  icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  description?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.themeOptionRow, selected && styles.themeOptionRowActive]}
      onPress={onPress}>
      {icon && <Icon name={icon} size={18} color={selected ? colors.primaryText : colors.textSecondary} />}
      <View style={styles.flex}>
        <Text style={[styles.themeOptionText, selected && styles.themeOptionTextActive]} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text style={styles.optionDescription} numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {selected && <Icon name="check" size={18} color={colors.primaryText} />}
    </Pressable>
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
  options: {
    padding: spacing.md,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    minHeight: touchTarget + 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  settingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  settingValue: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  themeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
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
  optionDescription: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
}));
