/**
 * Primeiro acesso de quem recebeu a senha da empresa ("Criar acesso com senha"):
 * antes de usar o app, a pessoa cria uma senha só dela (a empresa nunca fica sabendo).
 */
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { supabase } from '../../services/supabase';
import { Button, Card, CardText, CardTitle, Page } from '../components/ui';

const MIN_PASSWORD = 8;

export function NewPasswordScreen({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (password.length < MIN_PASSWORD) return setError(t('Use pelo menos {n} caracteres.', { n: MIN_PASSWORD }));
    if (password !== confirm) return setError(t('As duas senhas não são iguais.'));
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setBusy(false);
    if (err) {
      setError(
        /same|different/i.test(err.message)
          ? t('Escolha uma senha diferente da que a empresa passou.')
          : t('Não foi possível salvar a senha. Verifique a internet e tente de novo.'),
      );
      return;
    }
    onDone();
  };

  const field = (label: string, value: string, set: (v: string) => void, testID: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={set}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );

  return (
    <Page>
      <Card>
        <CardTitle>{t('Crie a sua senha')}</CardTitle>
        <CardText>
          {t('A empresa criou o seu acesso com uma senha inicial. Para a sua segurança, crie agora uma senha só sua: a empresa não fica sabendo dela.')}
        </CardText>
        {field(t('Senha nova'), password, setPassword, 'new-password')}
        {field(t('Repita a senha nova'), confirm, setConfirm, 'new-password-confirm')}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
      <Button testID="new-password-save" label={t('Salvar senha')} loading={busy} onPress={save} />
      <Button label={t('Sair da conta')} variant="secondary" icon="sair" onPress={onLogout} />
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  field: { gap: spacing.xs, marginTop: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  error: { fontSize: 13, color: colors.danger, marginTop: spacing.sm },
}));
