import { t } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardBridge } from '../../native/KeyboardBridge';
import { coralGlass, makeStyles, onCoralText, radius, spacing, touchTarget } from '../theme';
import { CoralSheen } from './Glass';
import { KeyconMark } from './KeyconLogo';

/**
 * Mostrado nas áreas de vendas (Produtos, Atalhos, IA, Mais) quando o
 * app não está logado. O teclado de letras (ABC) continua funcionando.
 *
 * No iPhone o teclado só enxerga os dados do app com o "Acesso Total" ligado
 * (sem ele, parece que ninguém entrou) e não consegue abrir o app.
 */
export function LoginRequiredPanel() {
  const styles = useStyles();
  const [fullAccess, setFullAccess] = useState(true);
  useEffect(() => {
    KeyboardBridge.hasFullAccess().then(setFullAccess);
  }, []);

  if (!fullAccess) {
    return (
      <View style={styles.container} testID="full-access-required">
        <KeyconMark size={36} />
        <Text style={styles.title}>{t('Ligue o Acesso Total do KEYCON')}</Text>
        <Text style={styles.desc}>
          {t('Sem ele, o iPhone não deixa o teclado ver os seus produtos, clientes e atalhos. Vá em Ajustes › Geral › Teclado › Teclados › KEYCON e ative Permitir Acesso Total. O botão ABC continua disponível para digitar.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="login-required">
      <KeyconMark size={36} />
      <Text style={styles.title}>{t('Entre no app para usar o teclado')}</Text>
      <Text style={styles.desc}>
        {t('Seus produtos e atalhos aparecem aqui depois do login no app KEYCON. Enquanto isso, o botão ABC continua disponível para digitar.')}</Text>
      {KeyboardBridge.canOpenApp ? (
        <Pressable
          testID="login-open-app"
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          onPress={() => KeyboardBridge.openApp()}>
          <CoralSheen radius={radius.md} />
          <Text style={styles.btnText}>{t('Abrir o app e entrar')}</Text>
        </Pressable>
      ) : (
        <Text style={styles.desc}>{t('Abra o app KEYCON na tela inicial do iPhone e entre na sua conta.')}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  desc: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    ...coralGlass(colors, { pill: false }),
  },
  pressed: { opacity: 0.85 },
  btnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600', ...onCoralText },
}));
