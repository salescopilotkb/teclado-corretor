import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LANGUAGES, t } from '../../i18n';
import type { Lang } from '../../i18n';
import { COUNTRIES, CURRENCIES, deduceFromMarketId, MARKETS, TARGET_AUDIENCES } from '../../i18n/markets';
import type { MarketId } from '../../i18n/markets';
import type { CountryId, CurrencyId, SellerProfile, TargetAudienceId } from '../../types';
import { glassBorder, makeStyles, radius, spacing } from '../../keyboard/theme';

function Chip({ label, detail, selected, onPress, testID }: { label: string; detail?: string; selected: boolean; onPress: () => void; testID?: string }) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {detail ? (
        <Text style={[styles.detail, selected && styles.detailSelected]} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Português · English · Español (cada um escrito no próprio idioma). */
export function LanguagePicker({ value, onChange }: { value: Lang; onChange: (lang: Lang) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {LANGUAGES.map(l => (
        <Chip key={l.id} testID={`lang-${l.id}`} label={l.label} selected={l.id === value} onPress={() => onChange(l.id)} />
      ))}
    </View>
  );
}

/** País onde o negócio opera */
export function CountryPicker({ value, onChange }: { value: CountryId; onChange: (id: CountryId) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {COUNTRIES.map(c => (
        <Chip
          key={c.id}
          testID={`country-${c.id}`}
          label={`${c.flag} ${t(c.name)}`}
          selected={c.id === value}
          onPress={() => onChange(c.id)}
        />
      ))}
    </View>
  );
}

/** Moeda das vendas */
export function CurrencyPicker({ value, onChange }: { value: CurrencyId; onChange: (id: CurrencyId) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {CURRENCIES.map(c => (
        <Chip
          key={c.id}
          testID={`currency-${c.id}`}
          label={`${c.id} (${c.symbol})`}
          detail={t(c.label)}
          selected={c.id === value}
          onPress={() => onChange(c.id)}
        />
      ))}
    </View>
  );
}

/** Para quem você vende (público-alvo / clientes) */
export function AudiencePicker({ value, onChange }: { value: TargetAudienceId; onChange: (id: TargetAudienceId) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.audienceList} accessibilityRole="radiogroup">
      {TARGET_AUDIENCES.map(a => {
        const selected = a.id === value;
        return (
          <Pressable
            key={a.id}
            testID={`audience-${a.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(a.id)}
            style={({ pressed }) => [styles.audienceCard, selected && styles.audienceCardSelected, pressed && styles.pressed]}>
            <View style={styles.audienceHead}>
              <Text style={styles.audienceFlag}>{a.flag}</Text>
              <View style={styles.audienceInfo}>
                <Text style={[styles.audienceTitle, selected && styles.audienceTitleSelected]}>{t(a.label)}</Text>
                <Text style={styles.audienceLang}>{a.languageLabel}</Text>
              </View>
            </View>
            <Text style={styles.audienceDesc}>{t(a.description)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const LANGUAGE_NAME: Record<Lang, string> = { pt: 'Português', en: 'English', es: 'Español' };

/** País + moeda + idioma das mensagens ("United States · USD · English"). */
export function MarketPicker({ value, onChange }: { value: MarketId; onChange: (id: MarketId) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {MARKETS.map(m => (
        <Chip
          key={m.id}
          testID={`market-${m.id}`}
          label={m.country}
          detail={`${m.currency} · ${LANGUAGE_NAME[m.language]}`}
          selected={m.id === value}
          onPress={() => onChange(m.id)}
        />
      ))}
    </View>
  );
}

/** Texto curto do mercado e público escolhidos ("Estados Unidos · USD · Brasileiros"). */
export function marketSummary(sellerOrId: SellerProfile | MarketId | string | null | undefined): string {
  if (typeof sellerOrId === 'object' && sellerOrId) {
    const deduced = deduceFromMarketId(sellerOrId.market);
    const countryId = sellerOrId.country ?? deduced.country;
    const currencyId = sellerOrId.currency ?? deduced.currency;
    const audienceId = sellerOrId.targetAudience ?? deduced.targetAudience;
    const c = COUNTRIES.find(x => x.id === countryId) ?? COUNTRIES[0];
    const aud = TARGET_AUDIENCES.find(x => x.id === audienceId) ?? TARGET_AUDIENCES[0];
    return `${t(c.name)} · ${currencyId} · ${t(aud.label)}`;
  }
  const deduced = deduceFromMarketId(sellerOrId as MarketId);
  const c = COUNTRIES.find(x => x.id === deduced.country) ?? COUNTRIES[0];
  const aud = TARGET_AUDIENCES.find(x => x.id === deduced.targetAudience) ?? TARGET_AUDIENCES[0];
  return `${t(c.name)} · ${deduced.currency} · ${t(aud.label)}`;
}

const useStyles = makeStyles(colors => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder(colors),
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderTopColor: colors.primary,
    borderWidth: 1,
  },
  pressed: { opacity: 0.75 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  labelSelected: { color: colors.primaryText, fontWeight: '600' },
  detail: { fontSize: 12, color: colors.textMuted },
  detailSelected: { color: colors.primaryText },
  audienceList: { gap: spacing.sm },
  audienceCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    ...glassBorder(colors),
  },
  audienceCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderTopColor: colors.primary,
    borderWidth: 1,
  },
  audienceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  audienceFlag: { fontSize: 22 },
  audienceInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audienceTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  audienceTitleSelected: { color: colors.primaryText },
  audienceLang: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  audienceDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
}));
