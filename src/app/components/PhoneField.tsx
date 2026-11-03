/**
 * Telefone do cliente com a bandeira do país (CRM do app). Tocar na bandeira escolhe
 * o país; colar ou digitar um número com o código ("+55 11...", "0052...") troca a
 * bandeira sozinho. O valor sai pronto para guardar: "+55 (11) 98765-4321".
 */
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { Icon } from '../../keyboard/components/Icon';
import {
  PHONE_COUNTRIES,
  countryName,
  detectPhoneCountry,
  joinPhone,
  refineByAreaCode,
  splitPhone,
} from '../../crm/phoneCountry';
import type { PhoneCountry } from '../../crm/phoneCountry';

interface Props {
  label: string;
  /** Telefone guardado ("+55 (11) 98765-4321" ou, antigo, sem o código). */
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  testID?: string;
}

export function PhoneField({ label, value, onChange, placeholder, testID }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const initial = useRef(splitPhone(value)).current;
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [picking, setPicking] = useState(false);

  const apply = (c: PhoneCountry, n: string) => {
    setCountry(c);
    setNational(n);
    onChange(joinPhone(c, n));
  };

  const onText = (text: string) => {
    // Colou (vários caracteres de uma vez) ou digitou com "+": acha o país pelo código
    const pasted = text.length - national.length >= 3;
    const found = detectPhoneCountry(text, country, pasted);
    if (found) apply(refineByAreaCode(found.country, found.national), found.national);
    else apply(refineByAreaCode(country, text), text);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          testID={testID ? `${testID}-country` : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('País do telefone: {country}. Toque para trocar.', { country: countryName(country) })}
          style={({ pressed }) => [styles.country, pressed && { opacity: 0.7 }]}
          onPress={() => setPicking(true)}>
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>+{country.dial}</Text>
          <Icon name="avancar" size={12} color={colors.textMuted} />
        </Pressable>
        <TextInput
          testID={testID}
          style={[styles.input, styles.flex]}
          value={national}
          onChangeText={onText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />
      </View>
      <CountryPicker
        visible={picking}
        selected={country}
        onClose={() => setPicking(false)}
        onPick={c => {
          setPicking(false);
          apply(c, national);
        }}
      />
    </View>
  );
}

/** Lista de países (com busca por nome ou código). */
function CountryPicker({
  visible,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  selected: PhoneCountry;
  onClose: () => void;
  onPick: (c: PhoneCountry) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '');
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(c => c.dial.startsWith(q) || Object.values(c.name).some(n => n.toLowerCase().includes(q)));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t('País do telefone')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Fechar')} hitSlop={8} onPress={onClose}>
              <Icon name="fechar" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Buscar país ou código')}
            placeholderTextColor={colors.textMuted}
          />
          <FlatList
            data={list}
            keyExtractor={c => c.iso}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, item.iso === selected.iso && styles.itemOn, pressed && { opacity: 0.7 }]}
                onPress={() => onPick(item)}>
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={[styles.itemName, styles.flex]} numberOfLines={1}>
                  {countryName(item)}
                </Text>
                <Text style={styles.dial}>+{item.dial}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  flex: { flex: 1 },
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', padding: spacing.lg },
  sheet: { maxHeight: '80%', backgroundColor: colors.canvas, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...typography.h2, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, minHeight: touchTarget, borderRadius: radius.md },
  itemOn: { backgroundColor: colors.primarySoft },
  itemName: { fontSize: 15, color: colors.text },
}));
