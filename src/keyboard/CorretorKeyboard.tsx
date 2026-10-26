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
import type { HeightMode } from '../native/KeyboardBridge';
import { LoginRequiredPanel } from './components/LoginRequiredPanel';
import { Repo } from '../storage/storage';
import type { CRMLead, KeyboardData, MainSystemTab, MenuTab, ThemePreference } from '../types';
import { FilesTab } from './components/FilesTab';
import { KeyboardAgenda } from './components/KeyboardAgenda';
import { KeyboardCRM } from './components/KeyboardCRM';
import { MoreTab } from './components/MoreTab';
import { ProductsTab } from './components/ProductsTab';
import { ShortcutsTab } from './components/ShortcutsTab';
import { SystemMenuBar } from './components/SystemMenuBar';
import { TranslatePanel } from './components/TranslatePanel';
import { TypingKeyboard } from './components/TypingKeyboard';
import { Aurora } from './components/Glass';
import { useKeyboardData } from './hooks/useKeyboardData';
import { buildLexicon } from './typing/lexicon';
import { useLanguage } from '../i18n/useLanguage';
import { applyProfileLanguages } from '../i18n/profile';
import { getSegment } from '../segments/segments';
import { makeStyles, radius, ThemeProvider } from './theme';

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
  /** CRM → "Agendar": a agenda abre já com o cliente. */
  const [scheduleFor, setScheduleFor] = useState<CRMLead | null>(null);

  const setExpanded = useCallback((expanded: boolean) => {
    KeyboardBridge.setExpanded(expanded).catch(() => {});
  }, []);

  // Agenda e CRM: teclado em tela grande, sobre a conversa
  const translatingRef = useRef(false);
  translatingRef.current = translating;
  // Tradução: tela grande, com o campo da conversa (já traduzido) à vista em cima
  useEffect(() => {
    if (!translating) return;
    setHeightModeNow('expanded');
    const off = KeyboardBridge.onKeyboardShow(() => setHeightModeNow('expanded'));
    return () => {
      off();
      // Fechou a tradução: volta ao tamanho da seção que estava aberta
      setHeightModeNow(bigRef.current ? 'expanded' : 'normal');
    };
  }, [translating]);

  const big = tab === 'agenda' || tab === 'crm';
  const bigRef = useRef(big);
  bigRef.current = big;
  useEffect(() => {
    if (!big) return;
    setExpanded(true);
    // Saiu da Agenda/CRM: volta ao normal (antes de a próxima seção pedir o tamanho dela)
    return () => setExpanded(false);
  }, [big, setExpanded]);
  const setHeightMode = useCallback((mode: HeightMode) => {
    KeyboardBridge.setHeightMode(mode).catch(() => {});
  }, []);

  const reorderMenu = useCallback((order: MenuTab[]) => {
    Repo.setMenuOrder(order);
    setMenuOrder(order);
  }, []);

  // Ao fechar o teclado, a próxima abertura começa no teclado de letras e a aba
  // Mais volta ao menu inicial. Exceção: fechou porque a galeria/câmera do
  // próprio teclado abriu — ao voltar, continua onde estava (ex.: no cadastro)
  useEffect(
    () =>
      KeyboardBridge.onKeyboardHide(() => {
        if (KeyboardBridge.isPickingMedia()) return;
        setTranslating(false);
        setTab('keyboard');
        setScheduleFor(null);
        setMoreVisit(v => v + 1);
      }),
    [],
  );

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

  return (
    <View style={styles.root} testID="corretor-keyboard">
      {/* Liquid Glass discreto: aurora suave atrás do menu, dos cards e das teclas */}
      <Aurora intensity={0.55} />
      {/* Menu com os botões do sistema SEMPRE VISÍVEL no topo */}
      <SystemMenuBar
        active={tab}
        onChange={handleTabChange}
        order={menuOrder}
        onReorder={reorderMenu}
        catalogLabel={segment.terms.catalog}
        translating={translating}
        onTranslate={() => setTranslating(v => !v)}
      />

      {/* Área de conteúdo: teclado de letras ou área de vendas */}
      <View style={styles.content}>
        {translating && <TranslatePanel onClose={() => setTranslating(false)} />}
        {!translating && tab === 'keyboard' && <TypingKeyboard />}
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
          />
        )}
        {!translating && loggedIn && tab === 'more' && (
          <MoreTab key={moreVisit} theme={data.theme} onThemeChange={onThemeChange} onInsert={insert} />
        )}

        {toast && (
          <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </View>
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
