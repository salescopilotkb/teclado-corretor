/**
 * App.tsx — App KEYCON (container do teclado)
 * -------------------------------------------------------------
 * Conta do usuário, Início (teclado, primeiros passos, tutorial),
 * catálogo, atalhos e Conta. Cada aba abre na sua tela principal;
 * os detalhes ficam em submenus dentro dela.
 */
import React, { useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { pullProfile, restoreSession, signOut, startAuthSync } from '../services/auth';
import { supabase } from '../services/supabase';
import { getSegment } from '../segments/segments';
import { Repo } from '../storage/storage';
import type { SellerProfile, ThemePreference } from '../types';
import { Icon } from '../keyboard/components/Icon';
import type { IconName } from '../keyboard/components/Icon';
import { KeyconLogo } from '../keyboard/components/KeyconLogo';
import { glassBorder, makeStyles, onCoralText, radius, spacing, ThemeProvider, useColors } from '../keyboard/theme';
import { Aurora } from '../keyboard/components/Glass';
import { t } from '../i18n';
import { applyProfileLanguages } from '../i18n/profile';
import { useLanguage } from '../i18n/useLanguage';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import type { AppTarget } from './screens/HomeScreen';
import { ProductsManagerScreen } from './screens/ProductsManagerScreen';
import { ProfileSettingsScreen } from './screens/ProfileSettingsScreen';
import type { AccountSection } from './screens/ProfileSettingsScreen';
import { AgendaScreen } from './screens/AgendaScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { FilesManagerScreen } from './screens/FilesManagerScreen';
import { TutorialScreen } from './screens/TutorialScreen';

type AppTab = 'home' | 'products' | 'clients' | 'agenda' | 'files' | 'profile';

const NAV_ITEMS: Array<{ key: AppTab; label: string; icon: IconName }> = [
  { key: 'home', label: 'Início', icon: 'casa' },
  // O nome muda com o ramo ("Imóveis", "Cardápio"...)
  { key: 'products', label: 'Produtos', icon: 'arquivos' },
  // Mesmos dados do CRM e da Agenda do teclado
  { key: 'clients', label: 'Clientes', icon: 'clientes' },
  { key: 'agenda', label: 'Agenda', icon: 'calendario' },
  // Pastas com fotos e vídeos (as mesmas da aba Arquivos do teclado)
  { key: 'files', label: 'Arquivos', icon: 'galeria' },
  // Configurações = engrenagem (manual de marca)
  { key: 'profile', label: 'Conta', icon: 'configuracoes' },
];

// Idioma e moeda do perfil salvo, antes da primeira tela
applyProfileLanguages(Repo.getSeller());

export default function App() {
  const [theme, setTheme] = useState<ThemePreference>(() => Repo.getTheme());
  return (
    // Liquid Glass: o app usa a paleta de vidro sobre a aurora
    <ThemeProvider preference={theme} glass>
      <AppShell onThemeChange={setTheme} />
    </ThemeProvider>
  );
}

function AppShell({ onThemeChange }: { onThemeChange: (theme: ThemePreference) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const barStyle = colors.scheme === 'dark' ? 'light-content' : 'dark-content';
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Repo.isLoggedIn());
  // Idioma: a área logada é recriada no idioma novo; o login/cadastro só redesenha
  // (para não perder o que já foi digitado)
  const language = useLanguage();
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  /** Muda a cada toque no menu: a aba volta para a tela principal dela. */
  const [tabVisit, setTabVisit] = useState(0);
  const [accountSection, setAccountSection] = useState<AccountSection>('root');
  /** Ficha do cliente → "Agendar": a Agenda abre o cadastro com ele. */
  const [scheduleClientId, setScheduleClientId] = useState<string | null>(null);
  // Tutorial abre sozinho no primeiro acesso da conta
  const [showTutorial, setShowTutorial] = useState(() => Repo.isLoggedIn() && !Repo.isTutorialSeen());
  // Perfil (nome no avatar, ramo nos menus); as telas releem o ramo ao abrir
  const [seller, setSeller] = useState<SellerProfile>(() => Repo.getSeller());
  const segment = getSegment(seller.segment);

  useEffect(() => {
    const stopSync = startAuthSync();
    // Confere a sessão do Supabase (desfaz logins antigos de demonstração)
    restoreSession().then(ok => {
      setIsAuthenticated(ok);
      if (ok)
        pullProfile()
          .then(p => {
            if (!p) return;
            setSeller(p);
            applyProfileLanguages(p);
          })
          .catch(() => {});
    });

    // Renova o token só com o app em primeiro plano (recomendação do Supabase p/ RN)
    supabase.auth.startAutoRefresh();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      stopSync();
      appState.remove();
    };
  }, []);

  // Se não estiver logado, exibe tela de Autenticação / Criação de Conta
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root}>
        <Aurora />
        <StatusBar barStyle={barStyle} backgroundColor={colors.canvas} />
        <AuthScreen
          onSuccess={() => {
            setSeller(Repo.getSeller());
            applyProfileLanguages(Repo.getSeller());
            setCurrentTab('home');
            setShowTutorial(!Repo.isTutorialSeen());
            setIsAuthenticated(true);
          }}
        />
      </SafeAreaView>
    );
  }

  const openTab = (tab: AppTab, section: AccountSection = 'root') => {
    setAccountSection(section);
    setScheduleClientId(null);
    setCurrentTab(tab);
    setTabVisit(v => v + 1);
  };

  const navigateFromHome = (target: AppTarget) => {
    if (target === 'catalog') openTab('products');
    else if (target === 'files') openTab('files');
    else openTab('profile', 'data');
  };

  if (showTutorial) {
    return (
      <SafeAreaView key={language} style={styles.root}>
        <Aurora />
        <StatusBar barStyle={barStyle} backgroundColor={colors.canvas} />
        <TutorialScreen
          segment={segment}
          onClose={() => {
            Repo.setTutorialSeen();
            setShowTutorial(false);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView key={language} style={styles.root}>
      <Aurora />
      <StatusBar barStyle={barStyle} backgroundColor={colors.canvas} />

      {/* Cabeçalho: logotipo KEYCON + atalho para a conta */}
      <View style={styles.topHeader}>
        <KeyconLogo size={28} />
        <Pressable
          style={styles.avatar}
          accessibilityLabel={t('Abrir conta')}
          onPress={() => openTab('profile')}>
          <Text style={styles.avatarText}>{initials(seller.name)}</Text>
        </Pressable>
      </View>

      {/* Área da Tela Ativa */}
      <View style={styles.screenBody}>
        {currentTab === 'home' && (
          <HomeScreen key={tabVisit} onNavigate={navigateFromHome} onOpenTutorial={() => setShowTutorial(true)} />
        )}
        {/* key: trocar de ramo recarrega a tela com os novos campos */}
        {currentTab === 'products' && <ProductsManagerScreen key={`${seller.segment}-${tabVisit}`} />}
        {currentTab === 'clients' && (
          <ClientsScreen
            key={`${seller.segment}-${tabVisit}`}
            onSchedule={lead => {
              openTab('agenda');
              setScheduleClientId(lead.id);
            }}
          />
        )}
        {currentTab === 'files' && <FilesManagerScreen key={tabVisit} />}
        {currentTab === 'agenda' && <AgendaScreen key={`${tabVisit}-${scheduleClientId ?? ''}`} presetClientId={scheduleClientId} />}
        {currentTab === 'profile' && (
          <ProfileSettingsScreen
            key={tabVisit}
            initialSection={accountSection}
            onProfileChange={p => {
              setSeller(p);
              applyProfileLanguages(p);
            }}
            onThemeChange={onThemeChange}
            onLogout={() => {
              signOut().catch(() => {});
              setIsAuthenticated(false);
            }}
          />
        )}
      </View>

      {/* Dock: menu inferior flutuante em vidro leve (o ativo em laranja leve) */}
      <View style={styles.navBar}>
        {NAV_ITEMS.map(item => {
          const active = currentTab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.navBtn}
              onPress={() => openTab(item.key)}>
              {/* Selecionado: só o ícone muda de cor (o salmão do teclado), sem fundo */}
              <Icon name={item.icon} size={22} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                {item.key === 'products' ? segment.terms.catalog : t(item.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/** Iniciais do usuário para o avatar do cabeçalho (ex.: "Ana Souza" → "AS"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const useStyles = makeStyles(colors => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
    // Cabeçalho sobre a aurora, sem faixa: o logotipo flutua
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...onCoralText,
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  screenBody: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.xs,
    borderRadius: 32,
    backgroundColor: colors.glassFillStrong,
    ...glassBorder(colors),
    // Sombra do dock (iOS/web); no Android a elevação marcaria o vidro translúcido
    shadowColor: '#000',
    shadowOpacity: colors.scheme === 'dark' ? 0.4 : 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  navBtn: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.pill,
  },
  navLabel: {
    // 6 itens: 11 px para "Arquivos" e "Clientes" caberem num celular de 360 dp
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  navLabelActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
}));
