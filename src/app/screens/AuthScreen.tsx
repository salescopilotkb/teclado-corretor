import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AuthError, signIn, signInWithApple, signInWithGoogle, signUp } from '../../services/auth';
import { Repo } from '../../storage/storage';
import type { SegmentId } from '../../types';
import { SegmentPicker } from '../components/SegmentPicker';
import { KeyconLogo } from '../../keyboard/components/KeyconLogo';
import { brand, coralGlass, glassBorder, makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { CoralSheen } from '../components/ui';
import { getLanguage, setLanguage, t } from '../../i18n';
import type { Lang } from '../../i18n';
import { defaultMarketFor, getMarket } from '../../i18n/markets';
import type { MarketId } from '../../i18n/markets';
import { useLanguage } from '../../i18n/useLanguage';
import { LanguagePicker, MarketPicker } from '../components/LanguagePickers';

interface Props {
  onSuccess: () => void;
}

/** Logotipo da Apple (botão "Continuar com a Apple", nas cores do botão) */
function AppleIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.37 12.6c-.02-2.36 1.93-3.5 2.02-3.55-1.1-1.61-2.82-1.83-3.43-1.86-1.46-.15-2.85.86-3.59.86-.74 0-1.88-.84-3.09-.82-1.59.02-3.06.93-3.88 2.35-1.66 2.87-.42 7.12 1.19 9.45.79 1.14 1.73 2.42 2.96 2.37 1.19-.05 1.64-.77 3.07-.77 1.44 0 1.84.77 3.09.75 1.28-.02 2.09-1.16 2.87-2.31.9-1.32 1.27-2.6 1.29-2.67-.03-.01-2.48-.95-2.5-3.8ZM14.01 5.66c.65-.79 1.09-1.89.97-2.99-.94.04-2.08.63-2.75 1.42-.6.7-1.13 1.82-.99 2.9 1.05.08 2.12-.53 2.77-1.33Z"
      />
    </Svg>
  );
}

/** Ícone oficial do Google com 4 cores */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function AuthScreen({ onSuccess }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState<SegmentId | null>(null);
  // Idioma: muda a tela na hora. Mercado: segue o idioma até a pessoa escolher outro
  const language = useLanguage();
  const [market, setMarket] = useState<MarketId>(() => defaultMarketFor(getLanguage()));
  const [marketTouched, setMarketTouched] = useState(false);

  const chooseLanguage = (lang: Lang) => {
    setLanguage(lang);
    if (!marketTouched) setMarket(defaultMarketFor(lang));
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      if (Repo.isLoggedIn()) {
        onSuccess();
      }
    } catch (e) {
      Alert.alert(t('Não foi possível entrar com o Google'), e instanceof AuthError ? e.message : String(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      await signInWithApple();
      if (Repo.isLoggedIn()) onSuccess();
    } catch (e) {
      Alert.alert(t('Não foi possível entrar com a Apple'), e instanceof AuthError ? e.message : String(e));
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('Atenção'), t('Preencha o e-mail e a senha.'));
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert(t('Atenção'), t('Preencha seu nome.'));
      return;
    }

    if (isRegister && !segment) {
      Alert.alert(t('Atenção'), t('Escolha o ramo do seu negócio. Se não encontrar o seu, escolha "Outro".'));
      return;
    }

    if (isRegister && password.length < 6) {
      Alert.alert(t('Atenção'), t('A senha precisa ter pelo menos 6 caracteres.'));
      return;
    }

    setLoading(true);
    try {
      if (!isRegister) {
        await signIn(email, password);
        onSuccess();
        return;
      }

      const result = await signUp({
        email,
        password,
        name: name.trim(),
        business: business.trim(),
        phone: phone.trim(),
        segment: segment ?? 'general',
        language,
        market,
      });
      if (result === 'signed_in') {
        onSuccess();
      } else {
        Alert.alert(
          t('Confirme seu e-mail'),
          t('Enviamos um link de confirmação para {email}. Abra o e-mail, toque no link e depois entre aqui com seu e-mail e senha.', { email: email.trim() }),
        );
        setIsRegister(false);
        setPassword('');
      }
    } catch (e) {
      Alert.alert(t('Não foi possível continuar'), e instanceof AuthError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Abertura: grafite com brilho coral e o logotipo (manual de marca) */}
      <View style={styles.hero}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="authGlow" cx="88%" cy="0%" r="85%" fx="88%" fy="0%">
              <Stop offset="0" stopColor={brand.coral} stopOpacity={0.6} />
              <Stop offset="0.45" stopColor={brand.coral} stopOpacity={0.18} />
              <Stop offset="1" stopColor={brand.coral} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#authGlow)" />
        </Svg>
        {/* Logotipo oficial com slogan (texto claro: o fundo aqui é sempre grafite) */}
        <KeyconLogo size={64} slogan textTone="light" />
      </View>

      <View style={styles.body}>
        {/* Idioma do app (vale também para quem só vai entrar) */}
        <View style={styles.languageRow}>
          <LanguagePicker value={language} onChange={chooseLanguage} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>
            {isRegister ? t('Crie sua conta') : t('Entre na sua conta')}
          </Text>
          <Text style={styles.subtitle}>
            {t('Seus produtos, fotos e atalhos ficam sincronizados com o teclado.')}</Text>
        </View>

        {/* Botão de Destaque Primário: Continuar com o Google (1 toque, sem senha) */}
        <View style={styles.googleSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Continuar com o Google')}
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && styles.googleBtnPressed,
              googleLoading && styles.googleBtnDisabled,
            ]}
            disabled={googleLoading || appleLoading || loading}
            onPress={handleGoogleLogin}>
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <View style={styles.googleBtnInner}>
                <GoogleIcon size={20} />
                <Text style={styles.googleBtnText}>{t('Continuar com o Google')}</Text>
              </View>
            )}
          </Pressable>
          {/* Continuar com a Apple: mesmo tamanho do Google (diretriz 4.8 da App Store e padrão visual da Apple) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Continuar com a Apple')}
            style={({ pressed }) => [
              styles.googleBtn,
              styles.appleBtn,
              pressed && styles.googleBtnPressed,
              pressed && styles.appleBtn,
              appleLoading && styles.googleBtnDisabled,
            ]}
            disabled={appleLoading || googleLoading || loading}
            onPress={handleAppleLogin}>
            {appleLoading ? (
              <ActivityIndicator size="small" color={colors.scheme === 'dark' ? '#000' : '#fff'} />
            ) : (
              <View style={styles.googleBtnInner}>
                <AppleIcon size={20} color={colors.scheme === 'dark' ? '#000' : '#fff'} />
                <Text style={[styles.googleBtnText, styles.appleBtnText]}>{t('Continuar com a Apple')}</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.googleHint}>
            {t('Entrada rápida em 1 toque + Links de reunião no Google Meet liberados.')}
          </Text>
        </View>

        {/* Divisor elegante "ou continue com e-mail" */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('ou continue com e-mail')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.tabToggle}>
          <Pressable
            style={[styles.toggleBtn, !isRegister && styles.toggleBtnActive]}
            onPress={() => setIsRegister(false)}>
            <Text style={[styles.toggleText, !isRegister && styles.toggleTextActive]}>
              {t('Entrar')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, isRegister && styles.toggleBtnActive]}
            onPress={() => setIsRegister(true)}>
            <Text style={[styles.toggleText, isRegister && styles.toggleTextActive]}>
              {t('Criar conta')}</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          {isRegister && (
            <>
              <Text style={styles.label}>{t('Nome Completo')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('Ex: Ana Souza')}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </>
          )}

          <Text style={styles.label}>{t('E-mail')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('seu@email.com.br')}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>{t('Senha')}</Text>
          <TextInput
            style={styles.input}
            placeholder={isRegister ? t('Crie uma senha (mínimo 6 caracteres)') : t('Sua senha de acesso')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {isRegister && (
            <>
              <Text style={styles.label}>{t('Nome do negócio (opcional)')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('Ex: Bella Store')}
                placeholderTextColor={colors.textMuted}
                value={business}
                onChangeText={setBusiness}
              />

              <Text style={styles.label}>{t('Telefone com WhatsApp')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('Ex: {phone}', { phone: getMarket(market).phoneExample })}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.label}>{t('Onde você vende?')}</Text>
              <Text style={styles.hint}>
                {t('Define a moeda dos preços e o idioma das mensagens que vão para os seus clientes.')}
              </Text>
              <MarketPicker
                value={market}
                onChange={id => {
                  setMarket(id);
                  setMarketTouched(true);
                }}
              />

              <Text style={styles.label}>{t('Qual é o seu ramo?')}</Text>
              <Text style={styles.hint}>
                {t('O app se adapta ao seu negócio: nomes, campos dos produtos, funil de clientes e a IA. Dá para trocar depois na tela Conta.')}</Text>
              <SegmentPicker value={segment} onChange={setSegment} />
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, loading && styles.submitBtnDisabled]}
            disabled={loading}
            onPress={handleSubmit}>
            <CoralSheen />
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRegister ? t('Criar conta e entrar') : t('Entrar')}
              </Text>
            )}
          </Pressable>
          <Text style={styles.emailNotice}>
            {t('No login por e-mail, os links de reunião podem ser liberados conectando sua conta Google depois.')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: brand.graphite,
    borderBottomLeftRadius: radius.xl + 4,
    borderBottomRightRadius: radius.xl + 4,
    overflow: 'hidden',
  },
  body: { padding: spacing.lg },
  languageRow: { marginBottom: spacing.md },
  header: { marginBottom: spacing.md, marginTop: spacing.sm },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  googleSection: {
    marginBottom: spacing.sm,
    gap: 6,
  },
  googleBtn: {
    backgroundColor: colors.surface,
    minHeight: touchTarget + 4,
    borderRadius: colors.glass ? radius.pill : radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    ...glassBorder(colors),
    borderWidth: 1.5,
    borderColor: colors.scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
  },
  // Botão da Apple: branco no tema escuro, preto no claro (como manda a Apple)
  appleBtn: {
    backgroundColor: colors.scheme === 'dark' ? '#FFFFFF' : '#000000',
    borderColor: colors.scheme === 'dark' ? '#FFFFFF' : '#000000',
  },
  appleBtnText: {
    color: colors.scheme === 'dark' ? '#000000' : '#FFFFFF',
  },
  googleBtnPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceAlt,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  googleHint: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  tabToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    borderRadius: radius.md,
  },
  toggleBtn: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primarySoft,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: colors.surface,
    ...glassBorder(colors),
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    minHeight: touchTarget + 4,
    justifyContent: 'center',
    borderRadius: colors.glass ? radius.pill : radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...coralGlass(colors),
  },
  submitBtnPressed: {
    backgroundColor: colors.primaryStrong,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    ...onCoralText,
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emailNotice: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
}));
