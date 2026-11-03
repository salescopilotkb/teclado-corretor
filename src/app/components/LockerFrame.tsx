/**
 * Moldura da aba Locker no app: parece uma área "fora do app", como o site
 * locker.keyconapp.com aberto no navegador. Uma barra de endereço com cadeado em
 * cima e a página embaixo, no MESMO tema do app e do teclado (escuro por padrão;
 * claro quando a pessoa escolhe o claro), com as cores do Locker web e o laranja
 * KEYCON nos destaques. O botão da barra copia o endereço do Locker web, para abrir
 * no navegador do computador com o mesmo e-mail e senha do KEYCON (um aviso logo
 * abaixo da barra explica, até a pessoa fechar).
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { t } from '../../i18n';
import { LOCKER_WEB_URL } from '../../files/locker';
import { storage } from '../../storage/storage';
import { usePlan } from '../../plans/usePlan';
import { Icon } from '../../keyboard/components/Icon';
import { brand, radius, spacing, ThemeProvider, useColors } from '../../keyboard/theme';

/** Cores da "página": as mesmas do Locker web em cada tema (locker/src/styles.css). */
const PAGES = {
  light: {
    chrome: '#E7E9EE',
    bar: '#FFFFFF',
    barBorder: 'rgba(36, 40, 51, 0.10)',
    page: '#F4F6FA',
    text: '#1B1E26',
    muted: '#5B6271',
    secure: '#16A34A',
  },
  dark: {
    chrome: '#0F1116',
    bar: '#1E2129',
    barBorder: 'rgba(255, 255, 255, 0.10)',
    page: '#14161D',
    text: '#F5F6F8',
    muted: '#A3A9B6',
    secure: '#4ADE80',
  },
};
type Page = (typeof PAGES)['light'];

const HINT_CLOSED = 'locker.webHint.closed';

export function LockerFrame({ children }: { children: React.ReactNode }) {
  // O mesmo tema do app e do teclado (e do Locker web)
  const scheme = useColors().scheme === 'light' ? 'light' : 'dark';
  const PAGE = PAGES[scheme];
  const styles = useMemo(() => frameStyles(PAGE), [PAGE]);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState(() => !storage.getBoolean(HINT_CLOSED));
  // Locker no computador: só com plano (o grátis guarda os 3 arquivos só no app e no teclado)
  const plan = usePlan();
  const host = LOCKER_WEB_URL.replace(/^https?:\/\//, '');

  const copyLink = () => {
    Clipboard.setString(LOCKER_WEB_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    Alert.alert(
      t('Link copiado'),
      t('Abra {host} no navegador do computador e entre com o mesmo e-mail e senha do KEYCON.', { host }),
    );
  };
  const closeHint = () => {
    storage.set(HINT_CLOSED, true);
    setHint(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PAGE.chrome }} testID="locker-frame">
      {/* Barra de endereço, como a do navegador */}
      <View style={styles.chrome}>
        <View style={styles.address} accessibilityRole="text" accessibilityLabel={t('Site seguro: {host}', { host })}>
          <Icon name="escudo" size={14} color={PAGE.secure} />
          <Text style={styles.host} numberOfLines={1}>
            {host}
          </Text>
        </View>
        {/* Copia o endereço do Locker web (para abrir no computador) */}
        {plan.limits.locker && (
          <Pressable
            testID="locker-copy-link"
            accessibilityRole="button"
            accessibilityLabel={t('Copiar o link do Locker')}
            hitSlop={6}
            style={({ pressed }) => [styles.open, pressed && { opacity: 0.8 }]}
            onPress={copyLink}>
            <Icon name={copied ? 'check' : 'link'} size={15} color={brand.white} />
            <Text style={styles.openText}>{copied ? t('Copiado') : t('Copiar link')}</Text>
          </Pressable>
        )}
      </View>
      {/* Aviso: o Locker também abre no navegador do computador, com o mesmo login */}
      {plan.limits.locker && hint && (
        <View style={styles.hint} testID="locker-web-hint">
          <Icon name="globo" size={15} color={PAGE.muted} />
          <Text style={styles.hintText}>
            {t('Use o Locker também no computador: abra {host} no navegador e entre com o mesmo e-mail e senha do KEYCON.', { host })}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Fechar aviso')} hitSlop={8} onPress={closeHint}>
            <Icon name="fechar" size={14} color={PAGE.muted} />
          </Pressable>
        </View>
      )}
      {/* A página: como um site, no tema do app (sem o vidro do app, igual ao Locker web) */}
      <View style={styles.page}>
        <ThemeProvider preference={scheme}>{children}</ThemeProvider>
      </View>
    </View>
  );
}

const frameStyles = (PAGE: Page) => ({
  chrome: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: PAGE.chrome,
  },
  address: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: PAGE.bar,
    borderWidth: 1,
    borderColor: PAGE.barBorder,
  },
  host: { flex: 1, fontSize: 13, color: PAGE.text, fontWeight: '500' as const },
  open: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: brand.coral,
  },
  openText: { fontSize: 13, fontWeight: '600' as const, color: brand.white },
  hint: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: PAGE.bar,
  },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17, color: PAGE.muted },
  page: {
    flex: 1,
    backgroundColor: PAGE.page,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden' as const,
  },
});
