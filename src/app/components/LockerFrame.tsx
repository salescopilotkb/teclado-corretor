/**
 * Moldura da aba Locker no app: parece uma área "fora do app", como o site
 * locker.keyconapp.com aberto no navegador. Uma barra de endereço com cadeado em
 * cima e a página sempre clara embaixo (em qualquer tema do app), com o laranja
 * KEYCON nos destaques. O botão da barra abre o Locker no navegador, já logado.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { LOCKER_WEB_URL, openLockerWeb } from '../../files/locker';
import { Icon } from '../../keyboard/components/Icon';
import { brand, radius, spacing, ThemeProvider } from '../../keyboard/theme';

/** Cores da "página": as mesmas do Locker web (claro, com o laranja KEYCON). */
const PAGE = {
  chrome: '#E7E9EE',
  bar: '#FFFFFF',
  barBorder: 'rgba(36, 40, 51, 0.10)',
  page: '#F4F6FA',
  text: '#1B1E26',
  muted: '#5B6271',
  secure: '#16A34A',
};

export function LockerFrame({ children }: { children: React.ReactNode }) {
  const [opening, setOpening] = useState(false);
  const host = LOCKER_WEB_URL.replace(/^https?:\/\//, '');

  const openInBrowser = () => {
    setOpening(true);
    openLockerWeb()
      .catch(() => Alert.alert(t('Erro'), t('Não foi possível abrir o Locker no navegador.')))
      .finally(() => setOpening(false));
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
        {/* Na demonstração abre o Locker web de exemplo */}
        {(

          <Pressable
            testID="locker-open-web"
            accessibilityRole="button"
            accessibilityLabel={t('Abrir o Locker no navegador')}
            hitSlop={6}
            disabled={opening}
            style={({ pressed }) => [styles.open, pressed && { opacity: 0.8 }]}
            onPress={openInBrowser}>
            {opening ? <ActivityIndicator size="small" color={brand.white} /> : <Icon name="globo" size={15} color={brand.white} />}
            <Text style={styles.openText}>{t('Abrir')}</Text>
          </Pressable>
        )}
      </View>
      {/* A página: sempre clara, como um site (os componentes usam o tema claro aqui dentro) */}
      <View style={styles.page}>
        <ThemeProvider preference="light">{children}</ThemeProvider>
      </View>
    </View>
  );
}

const styles = {
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
  page: {
    flex: 1,
    backgroundColor: PAGE.page,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden' as const,
  },
};
