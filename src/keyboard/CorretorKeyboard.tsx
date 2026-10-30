/**
 * CorretorKeyboard.tsx — Componente RAIZ do teclado KEYCON.
 * Menu SEMPRE VISÍVEL no topo do teclado: logotipo e ícone do teclado de
 * letras (fixo) em cima; embaixo Arquivos, Produtos, Atalhos, Agenda, CRM e
 * Mais, na ordem que o usuário escolher (segurar e arrastar).
 */
import { t, tSell } from '../i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { KeyboardBridge } from '../native/KeyboardBridge';
import { keyboardBack, useKeyboardBack } from '../navigation/back';
import type { HeightMode } from '../native/KeyboardBridge';
import { LoginRequiredPanel } from './components/LoginRequiredPanel';
import { Repo } from '../storage/storage';
import type { CRMLead, KeyboardData, MainSystemTab, MenuTab, SellerProfile, ThemePreference } from '../types';
import { pushProfile } from '../services/auth';
import { FilesTab } from './components/FilesTab';
import { KeyboardAgenda } from './components/KeyboardAgenda';
import { KeyboardCRM } from './components/KeyboardCRM';
import { MoreTab } from './components/MoreTab';
import { KeyboardSizeContext } from './components/ResizeHandle';
import type { KeyboardSize } from './components/ResizeHandle';
import { isProductFormOpen, ProductsTab } from './components/ProductsTab';
import { ShortcutsTab } from './components/ShortcutsTab';
import { SystemMenuBar } from './components/SystemMenuBar';
import { TranslatePanel } from './components/TranslatePanel';
import { TypingKeyboard } from './components/TypingKeyboard';
import { ConfirmBox } from './components/KeyboardButtons';
import { Aurora } from './components/Glass';
import { useKeyboardData } from './hooks/useKeyboardData';
import { buildLexicon } from './typing/lexicon';
import { useLanguage } from '../i18n/useLanguage';
import { applyProfileLanguages } from '../i18n/profile';
import { getSegment } from '../segments/segments';
import { makeStyles, radius, ThemeProvider } from './theme';
import { DEMO_MODE } from '../config/demo';

/** Tamanho do teclado (usado fora do componente pela tradução). */
function setHeightModeNow(mode: HeightMode) {
  KeyboardBridge.setHeightMode(mode).catch(() => {});
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** iPhone: o teclado copia o arquivo e a pessoa cola no campo da conversa. */
const PASTE_HINT_MS = 5000;

/** Garante ponto final para juntar duas frases no aviso. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// Erros JS não tratados também vão para o diagnóstico nativo do teclado.
// O tratamento padrão do React Native continua sendo chamado.
// (ErrorUtils não existe na versão web de testes.)
if (typeof ErrorUtils !== 'undefined') {
  const defaultErrorHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    KeyboardBridge.reportError(`${isFatal ? '[fatal] ' : ''}${describeError(error)}`);
    defaultErrorHandler(error, isFatal);
  });
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string | null;
}

class KeyboardErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error: describeError(error) };
  }

  componentDidCatch(error: unknown) {
    KeyboardBridge.reportError(describeError(error));
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          message={this.state.error}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  const styles = useStyles();
  return (
    <View style={[styles.root, styles.errorContainer]}>
      <Text style={styles.errorTitle}>{t('KEYCON')}</Text>
      <Text style={styles.errorSubtitle}>{message || t('Erro ao inicializar visualização')}</Text>
      <Text style={styles.errorButton} onPress={onRetry}>
        {t('Tentar novamente')}</Text>
    </View>
  );
}

interface ContentProps {
  data: KeyboardData;
  /** Mesmo login do app (armazenamento compartilhado). */
  loggedIn: boolean;
  onThemeChange: (theme: ThemePreference) => void;
  onDataChanged: () => void;
}

function CorretorKeyboardContent({ data, loggedIn, onThemeChange, onDataChanged }: ContentProps) {
  useLanguage();
  const styles = useStyles();

  useEffect(() => {
    applyProfileLanguages(data.seller);
  }, [data.seller]);
  // O teclado sempre abre no teclado de letras (ABC)
  const [tab, setTab] = useState<MainSystemTab>('keyboard');
  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Evita disparar vários downloads ao tocar repetidas vezes. */
  const sending = useRef(false);
  /** Última aba da área de vendas — o botão do teclado volta para ela. */
  const lastSalesTab = useRef<MainSystemTab>('products');
  const segment = getSegment(data.seller.segment);
  /** Muda a cada campo novo: a aba Mais volta ao menu (o teclado já voltou ao tamanho normal). */
  const [moreVisit, setMoreVisit] = useState(0);
  /** Ordem dos botões do menu (mesmo armazenamento do app). */
  const [menuOrder, setMenuOrder] = useState<MenuTab[]>(() => Repo.getMenuOrder());
  /** Tradução simultânea aberta (painel por cima do conteúdo). */
  const [translating, setTranslating] = useState(false);
  /** Tocou no 🌐 do menu: pergunta antes de sair do KEYCON. */
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  /** CRM → "Agendar": a agenda abre já com o cliente. */
  const [scheduleFor, setScheduleFor] = useState<CRMLead | null>(null);

  const setExpanded = useCallback((expanded: boolean) => {
    KeyboardBridge.setExpanded(expanded).catch(() => {});
  }, []);

  // Agenda e CRM: teclado em tela grande, sobre a conversa
  const translatingRef = useRef(false);
  translatingRef.current = translating;
  // Tradução: só a faixa a mais sobre o teclado; a conversa e o campo dela ficam à vista
  useEffect(() => {
    if (!translating) return;
    setHeightModeNow('translate');
    const off = KeyboardBridge.onKeyboardShow(() => setHeightModeNow('translate'));
    return () => {
      off();
      // Fechou a tradução: volta ao tamanho da seção que estava aberta
      setHeightModeNow(bigRef.current ? 'expanded' : 'normal');
    };
  }, [translating]);

  const big = tab === 'agenda' || tab === 'crm';
  const bigRef = useRef(big);
  bigRef.current = big;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Altura atual e limites do teclado, para a barrinha de puxar (ResizeHandle).
  // Os limites mudam ao girar o celular: relê a cada vez que o teclado abre
  const keyboardSize = useRef<KeyboardSize>({ height: 350, normal: 350, max: 700 });
  useEffect(() => {
    const read = () =>
      KeyboardBridge.getKeyboardHeights()
        .then(h => {
          keyboardSize.current.normal = h.normal;
          keyboardSize.current.max = h.max;
        })
        .catch(() => {});
    read();
    return KeyboardBridge.onKeyboardShow(read);
  }, []);
  /** A barrinha passou da altura mínima: volta ao teclado de letras. */
  const collapseToKeyboard = useCallback(() => setTab('keyboard'), []);
  useEffect(() => {
    if (!big) return;
    setExpanded(true);
    // Fechou e reabriu o teclado na Agenda/CRM: o Android volta ao tamanho normal ao
    // fechar, então pede a tela grande de novo (senão a aba abre cortada)
    const off = KeyboardBridge.onKeyboardShow(() => {
      if (!translatingRef.current) setExpanded(true);
    });
    // Saiu da Agenda/CRM: volta ao normal (antes de a próxima seção pedir o tamanho dela)
    return () => {
      off();
      setExpanded(false);
    };
  }, [big, setExpanded]);
  const setHeightMode = useCallback((mode: HeightMode) => {
    KeyboardBridge.setHeightMode(mode).catch(() => {});
  }, []);

  /**
   * Configurações do Mais (ramo, idioma, onde vende): grava no aparelho na hora
   * (o teclado já muda) e manda para a nuvem em segundo plano, como no app.
   */
  const saveProfile = useCallback(
    (profile: SellerProfile) => {
      Repo.setSeller(profile);
      onDataChanged();
      pushProfile(profile).catch(() => {
        // Sem internet: fica salvo neste aparelho e sobe na próxima vez que o app salvar o perfil
      });
    },
    [onDataChanged],
  );

  const reorderMenu = useCallback((order: MenuTab[]) => {
    Repo.setMenuOrder(order);
    setMenuOrder(order);
  }, []);

  // Ao fechar o teclado, a próxima abertura começa no teclado de letras e a aba
  // Mais volta ao menu inicial. Exceções: a galeria/câmera do próprio teclado
  // abriu, ou estava na Agenda, no CRM ou no cadastro de produto — ao voltar,
  // continua onde estava (o ProductsTab pede a tela grande de novo)
  useEffect(
    () =>
      KeyboardBridge.onKeyboardHide(() => {
        if (KeyboardBridge.isPickingMedia() || bigRef.current) return;
        if (tabRef.current === 'products' && isProductFormOpen()) return;
        setTranslating(false);
        setConfirmSwitch(false);
        setTab('keyboard');
        setScheduleFor(null);
        setMoreVisit(v => v + 1);
      }),
    [],
  );

  // Tocou no campo de mensagem do app (ex.: WhatsApp): volta ao teclado de letras,
  // de qualquer tela. O cadastro de produto aberto fica guardado (volta ao abrir
  // Produtos). Na tradução, o toque só troca onde se digita (TranslatePanel).
  useEffect(
    () =>
      KeyboardBridge.onFocusDeviceField(() => {
        if (translatingRef.current) return;
        setConfirmSwitch(false);
        setTab('keyboard');
        setScheduleFor(null);
        setMoreVisit(v => v + 1);
      }),
    [],
  );

  // "Voltar" do celular (botão ou gesto): o Android só entrega ao teclado quando
  // alguma tela daqui tem para onde voltar; sem nenhuma, o teclado fecha como sempre
  useEffect(() => {
    const offEnabled = keyboardBack.onChange(enabled => KeyboardBridge.setBackEnabled(enabled));
    const offPress = KeyboardBridge.onBackPressed(() => {
      keyboardBack.handle();
    });
    return () => {
      offEnabled();
      offPress();
    };
  }, []);

  useEffect(() => {
    KeyboardBridge.notifyReady();
    // Dicionário das sugestões pronto antes da 1ª tecla (leva ~0,1 s, uma vez)
    const t = setTimeout(buildLexicon, 300);
    return () => clearTimeout(t);
  }, []);

  const showToast = useCallback(
    (msg: string, durationMs = 1200) => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Animated.timing(toastOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, durationMs);
    },
    [toastOpacity],
  );

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const insert = useCallback(
    async (text: string) => {
      try {
        const ok = await KeyboardBridge.insertText(text);
        showToast(ok ? t('Inserido') : t('Campo indisponível'));
      } catch {
        showToast(t('Não foi possível inserir'));
      }
    },
    [showToast],
  );

  /**
   * Foto direto na conversa (mesmo recurso dos GIFs do Gboard). Se o app não
   * aceitar imagem ou o link não for de um arquivo, insere o link como antes.
   */
  const sendImage = useCallback(
    async (url: string, title: string) => {
      if (sending.current) {
        showToast(t('Aguarde o envio anterior'));
        return;
      }
      sending.current = true;
      showToast(t('Baixando foto...'), 30000);
      let reason: string;
      try {
        const result = await KeyboardBridge.commitImage(url, title);
        if (result === 'sent') {
          showToast(t('Foto enviada para a conversa'));
          return;
        }
        if (result === 'copied') {
          showToast(t('Foto copiada: toque e segure no campo da conversa e escolha Colar'), PASTE_HINT_MS);
          return;
        }
        reason = result === 'unsupported' ? t('Este app não recebe fotos pelo teclado') : t('O app recusou a foto');
      } catch (e) {
        reason = t(describeError(e));
      } finally {
        sending.current = false;
      }
      const ok = await KeyboardBridge.insertText(`[${tSell('Foto')}] ${title}: ${url}`).catch(() => false);
      showToast(ok ? t('{v} Link inserido.', { v: sentence(reason) }) : reason, 4000);
    },
    [showToast],
  );

  /**
   * Áudio, vídeo e várias fotos: baixa e abre o compartilhamento do Android
   * (direto no app em foco, quando possível). Se falhar, insere o texto/link.
   */
  const shareMedia = useCallback(
    async (urls: string[], fallbackText: string) => {
      if (sending.current) {
        showToast(t('Aguarde o envio anterior'));
        return;
      }
      sending.current = true;
      showToast(urls.length > 1 ? t('Baixando {length} arquivos...', { length: urls.length }) : t('Baixando arquivo...'), 60000);
      try {
        const result = await KeyboardBridge.shareMedia(urls);
        if (result === 'copied') {
          showToast(
            urls.length > 1
              ? t('Arquivos copiados: toque e segure no campo da conversa e escolha Colar')
              : t('Arquivo copiado: toque e segure no campo da conversa e escolha Colar'),
            PASTE_HINT_MS,
          );
        } else showToast(t('Escolha a conversa para enviar'), 2500);
      } catch (e) {
        const reason = t(describeError(e));
        const ok = await KeyboardBridge.insertText(fallbackText).catch(() => false);
        showToast(ok ? t('{v} Link inserido.', { v: sentence(reason) }) : reason, 4000);
      } finally {
        sending.current = false;
      }
    },
    [showToast],
  );

  /** Agenda e CRM: enviou para a conversa, volta ao teclado de letras e mostra a conversa. */
  const sendAndClose = useCallback(
    (text: string) => {
      insert(text);
      setScheduleFor(null);
      setTab('keyboard');
    },
    [insert],
  );

  /**
   * Foto com o texto de legenda (ficha do produto): no WhatsApp vão juntos,
   * numa mensagem só — a pessoa só escolhe a conversa. Se não der para
   * compartilhar, insere o texto (sem a foto) e avisa.
   */
  const shareWithCaption = useCallback(
    async (urls: string[], caption: string) => {
      if (sending.current) {
        showToast(t('Aguarde o envio anterior'));
        return;
      }
      sending.current = true;
      showToast(t('Baixando foto...'), 60000);
      try {
        const result = await KeyboardBridge.shareWithCaption(urls, caption);
        if (result === 'copied') {
          // iPhone: o texto já entrou no campo; a foto vai copiada
          showToast(t('Texto inserido e foto copiada: toque e segure no campo e escolha Colar'), PASTE_HINT_MS);
        } else if (DEMO_MODE) {
          // Versão web: a conversa de teste já recebeu a foto com o texto
          showToast(t('Foto e texto enviados na conversa'), 2000);
        } else showToast(t('Escolha a conversa: a foto vai com o texto, numa mensagem só'), 3500);
      } catch (e) {
        const reason = t(describeError(e));
        const ok = await KeyboardBridge.insertText(caption).catch(() => false);
        showToast(ok ? t('{v} Texto inserido sem a foto.', { v: sentence(reason) }) : reason, 4000);
      } finally {
        sending.current = false;
      }
    },
    [showToast],
  );

  // O botão do teclado alterna entre a área de vendas e o teclado de letras (como no simulador).
  // A troca para outro teclado do sistema (Gboard etc.) fica na tecla 🌐.
  const handleTabChange = useCallback((newTab: MainSystemTab) => {
    setScheduleFor(null);
    setConfirmSwitch(false);
    // Tocar no menu fecha a tradução (o ícone do teclado volta para as letras)
    if (translatingRef.current) {
      setTranslating(false);
      if (newTab === 'keyboard') {
        setTab('keyboard');
        return;
      }
    }
    setTab(current => {
      if (newTab === 'keyboard' && current === 'keyboard') return lastSalesTab.current;
      if (newTab !== 'keyboard') lastSalesTab.current = newTab;
      return newTab;
    });
  }, []);

  // Numa seção (Produtos, Arquivos, Atalhos...), o "voltar" do celular volta ao teclado de letras.
  // As subtelas de cada seção ficam por cima e voltam antes (cabeçalho, busca, pasta)
  useKeyboardBack(() => handleTabChange('keyboard'), tab !== 'keyboard' && !translating);

  // Agenda e CRM abrem em tela grande: o menu desce, perto do polegar, e a área fica mais livre
  const menuAtBottom = big && !translating;
  const menu = (
    <SystemMenuBar
      active={tab}
      onChange={handleTabChange}
      order={menuOrder}
      onReorder={reorderMenu}
      catalogLabel={segment.terms.catalog}
      translating={translating}
      onTranslate={() => setTranslating(v => !v)}
      onSwitchKeyboard={() => setConfirmSwitch(v => !v)}
      atBottom={menuAtBottom}
    />
  );

  return (
    <KeyboardSizeContext.Provider value={keyboardSize}>
    <View
      style={styles.root}
      testID="corretor-keyboard"
      onLayout={e => {
        keyboardSize.current.height = e.nativeEvent.layout.height;
      }}>
      {/* Liquid Glass discreto: aurora suave atrás do menu, dos cards e das teclas */}
      <Aurora intensity={0.55} />
      {/* Menu com os botões do sistema SEMPRE VISÍVEL no topo (Agenda e CRM: embaixo) */}
      {!menuAtBottom && menu}

      {/* Área de conteúdo: teclado de letras ou área de vendas */}
      <View style={styles.content}>
        {translating && <TranslatePanel onClose={() => setTranslating(false)} />}
        {confirmSwitch && (
          <SwitchConfirm
            onCancel={() => setConfirmSwitch(false)}
            onConfirm={() => {
              setConfirmSwitch(false);
              KeyboardBridge.switchKeyboard();
            }}
          />
        )}
        {!translating && tab === 'keyboard' && <TypingKeyboard key={`typing-${moreVisit}`} />}
        {/* Sem login no app, a área de vendas fica bloqueada (o ABC continua livre) */}
        {!translating && tab !== 'keyboard' && !loggedIn && <LoginRequiredPanel />}
        {!translating && loggedIn && tab === 'products' && (
          <ProductsTab
            folders={data.folders}
            segment={segment}
            onInsert={insert}
            onSendImage={sendImage}
            onShare={shareMedia}
            onShareWithCaption={shareWithCaption}
            onExpandedChange={setExpanded}
            onChanged={onDataChanged}
          />
        )}
        {!translating && loggedIn && tab === 'shortcuts' && (
          <ShortcutsTab shortcuts={data.shortcuts} seller={data.seller} onInsert={insert} onShare={shareMedia} onHeightChange={setHeightMode} onChanged={onDataChanged} />
        )}
        {!translating && loggedIn && tab === 'files' && (
          <FilesTab
            files={data.files}
            onSendImage={sendImage}
            onShare={shareMedia}
            onInsert={insert}
            onExpandedChange={setExpanded}
            onCollapse={collapseToKeyboard}
            onChanged={onDataChanged}
          />
        )}
        {!translating && loggedIn && tab === 'agenda' && (
          <KeyboardAgenda
            agenda={data.agenda}
            leads={data.crm}
            presetClient={scheduleFor}
            onInsert={sendAndClose}
            onChanged={onDataChanged}
            onClose={() => handleTabChange('keyboard')}
          />
        )}
        {!translating && loggedIn && tab === 'crm' && (
          <KeyboardCRM
            segment={segment}
            leads={data.crm}
            agenda={data.agenda}
            onInsert={sendAndClose}
            onChanged={onDataChanged}
            onClose={() => handleTabChange('keyboard')}
            onSchedule={lead => {
              lastSalesTab.current = 'agenda';
              setTab('agenda');
              setScheduleFor(lead);
            }}
            onCollapse={collapseToKeyboard}
          />
        )}
        {!translating && loggedIn && tab === 'more' && (
          <MoreTab
            key={moreVisit}
            theme={data.theme}
            onThemeChange={onThemeChange}
            seller={data.seller}
            onProfileChange={saveProfile}
            onExpandedChange={setExpanded}
            onCollapse={collapseToKeyboard}
          />
        )}

        {toast && (
          <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </View>
      {menuAtBottom && menu}
    </View>
    </KeyboardSizeContext.Provider>
  );
}

/** Pergunta antes de trocar para o teclado do sistema; o "voltar" do celular cancela. */
function SwitchConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const styles = useStyles();
  useKeyboardBack(onCancel);
  return (
    <View style={styles.confirmSwitch} testID="switch-confirm">
      <ConfirmBox
        testID="switch-confirm-yes"
        message={t('Você quer trocar para o teclado padrão do sistema?')}
        confirmLabel={t('Trocar')}
        confirmIcon="globo"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </View>
  );
}

function KeyboardRoot() {
  const { data, loggedIn, setTheme, reload } = useKeyboardData();
  return (
    // Paleta de vidro (Liquid Glass), como no app; as teclas continuam sólidas
    <ThemeProvider preference={data.theme} glass>
      <CorretorKeyboardContent data={data} loggedIn={loggedIn} onThemeChange={setTheme} onDataChanged={reload} />
    </ThemeProvider>
  );
}

// O ErrorBoundary fica por fora de tudo: um erro ao ler os dados ou o tema
// mostra a mensagem em vez de deixar o teclado em branco.
export default function CorretorKeyboard() {
  return (
    <KeyboardErrorBoundary>
      <KeyboardRoot />
    </KeyboardErrorBoundary>
  );
}

const useStyles = makeStyles(colors => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
  },
  // Fundo sólido: as teclas não aparecem por trás da pergunta
  // Fundo sólido (canvas): no vidro, bg/surface são transparentes e o texto de baixo aparecia junto
  confirmSwitch: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    zIndex: 50,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toast: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: colors.toastBg,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 99,
  },
  toastText: {
    color: colors.toastText,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  errorSubtitle: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorButton: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
    padding: 12,
  },
}));
