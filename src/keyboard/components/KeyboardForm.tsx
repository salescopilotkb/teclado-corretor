/**
 * Formulário dentro do teclado (cadastro de cliente, compromisso...).
 *
 * O teclado do sistema não pode ter TextInput: ele pegaria o foco e o campo
 * da conversa (WhatsApp) perderia o teclado. Então cada campo aqui é só um
 * "visor", e o teclado de letras do KEYCON escreve nele (TextSink).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { InputContext } from '../../native/KeyboardBridge';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, useColors } from '../theme';
import { TypingKeyboard } from './TypingKeyboard';
import type { TextSink } from './TypingKeyboard';

/** Tipos de campo do Android: o teclado usa para maiúscula automática e sugestões. */
const INPUT_TYPE = {
  text: 0x1 | 0x4000, // frases com maiúscula
  multiline: 0x1 | 0x4000 | 0x20000, // texto longo (descrição)
  name: 0x1 | 0x2000, // cada palavra com maiúscula
  phone: 0x3,
  money: 0x2, // só números: o valor é montado como em maquininha
  search: 0x1 | 0xb0, // busca: sem maiúscula nem correção automática
  url: 0x1 | 0x10, // link: sem maiúscula nem correção automática
} as const;

/** Campos que abrem o teclado já nos números. */
const NUMERIC_KINDS = new Set<FormFieldSpec['kind']>(['phone', 'money']);

export interface FormFieldSpec {
  key: string;
  /** Em português: o campo traduz na tela. */
  label: string;
  placeholder: string;
  kind?: keyof typeof INPUT_TYPE;
  /** Como o valor aparece no visor (ex.: dígitos do preço → "R$ 189,90"). */
  format?: (value: string) => string;
}

/** Preço: guarda só os dígitos, sem zeros à esquerda (até 13). */
const onlyDigits = (v: string) => v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);

export function useKeyboardForm(fields: FormFieldSpec[], initial: Record<string, string> = {}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initial }));
  const [active, setActive] = useState<string>(fields[0]?.key ?? '');

  // Os toques do teclado chegam fora do ciclo do React: estado atual em refs
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const activeRef = useRef(active);
  activeRef.current = active;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const update = useCallback((fn: (v: string) => string) => {
    const key = activeRef.current;
    const money = fieldsRef.current.find(f => f.key === key)?.kind === 'money';
    const value = fn(valuesRef.current[key] ?? '');
    const next = { ...valuesRef.current, [key]: money ? onlyDigits(value) : value };
    valuesRef.current = next;
    setValues(next);
  }, []);

  const sink = useMemo<TextSink>(
    () => ({
      insertText: async text => {
        update(v => v + text);
        return true;
      },
      deleteBackward: async () => {
        const had = (valuesRef.current[activeRef.current] ?? '').length > 0;
        update(v => Array.from(v).slice(0, -1).join(''));
        return had;
      },
      replaceTextBeforeCursor: async (count, text) => {
        update(v => v.slice(0, Math.max(0, v.length - count)) + text);
        return true;
      },
      // ↵ = próximo campo
      sendEnter: async () => {
        const list = fieldsRef.current;
        const i = list.findIndex(f => f.key === activeRef.current);
        if (i >= 0 && i < list.length - 1) setActive(list[i + 1].key);
        return true;
      },
      getInputContext: async (): Promise<InputContext> => {
        const field = fieldsRef.current.find(f => f.key === activeRef.current);
        return {
          before: valuesRef.current[activeRef.current] ?? '',
          inputType: INPUT_TYPE[field?.kind ?? 'text'],
        };
      },
    }),
    [update],
  );

  const setValue = useCallback((key: string, value: string) => {
    const next = { ...valuesRef.current, [key]: value };
    valuesRef.current = next;
    setValues(next);
  }, []);

  return { values, setValue, active, setActive, sink };
}

interface FieldProps {
  spec: FormFieldSpec;
  value: string;
  active: boolean;
  onPress: () => void;
}

/** Visor de um campo: toque para escolher onde o teclado escreve. */
export function KeyboardFormField({ spec, value, active, onPress }: FieldProps) {
  const styles = useStyles();
  const long = spec.kind === 'multiline';
  const shown = value && spec.format ? spec.format(value) : value;
  // Digitando um texto longo: mostra o fim, onde o cursor está
  const limit = long ? 150 : 60;
  const visible = active && shown.length > limit ? `…${shown.slice(-limit)}` : shown;
  return (
    <Pressable
      testID={`kbfield-${spec.key}`}
      accessibilityRole="button"
      accessibilityLabel={t(spec.label)}
      onPress={onPress}
      style={[styles.field, active && styles.fieldActive]}>
      <Text style={[styles.label, active && styles.labelActive]}>{t(spec.label)}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={long ? 4 : 2}>
          {visible || (active ? '' : t(spec.placeholder))}
        </Text>
        {active && <View style={styles.caret} />}
      </View>
    </Pressable>
  );
}

/** Teclado de letras ligado ao campo ativo do formulário. */
export function KeyboardFormKeys({ sink, activeKey, spec }: { sink: TextSink; activeKey: string; spec?: FormFieldSpec }) {
  const styles = useStyles();
  return (
    <View style={styles.keys}>
      {/* Recria ao trocar de campo: maiúscula automática, sugestões e números do campo novo */}
      <TypingKeyboard key={activeKey} sink={sink} initialMode={NUMERIC_KINDS.has(spec?.kind) ? 'numeric' : 'alpha'} />
    </View>
  );
}

/** Linha de opções (etapa do funil, tipo do compromisso, horário...). */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  label,
  onCard,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  label?: (o: { value: T; label: string }) => string;
  /** Dentro de um card (fundo surface): opções num tom mais claro. */
  onCard?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.choices}>
      {options.map(o => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.choice, onCard && styles.choiceOnCard, selected && styles.choiceSelected]}
            onPress={() => onChange(o.value)}>
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]} numberOfLines={1}>
              {label ? label(o) : o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 54,
  },
  fieldActive: { borderColor: colors.primary },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.primaryText },
  valueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, minHeight: 22 },
  value: { fontSize: 15, color: colors.text, flexShrink: 1 },
  placeholder: { color: colors.textMuted },
  caret: { width: 2, height: 18, backgroundColor: colors.primary, marginLeft: 1 },
  keys: { height: 236 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  choiceOnCard: { backgroundColor: colors.surfaceAlt },
  choiceSelected: { backgroundColor: colors.primarySoft },
  choiceText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  choiceTextSelected: { color: colors.primaryText, fontWeight: '600' },
}));
