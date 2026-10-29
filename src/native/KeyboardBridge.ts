/**
 * Wrapper tipado sobre o NativeModule `KeyboardBridge` (Kotlin / Swift).
 *
 * Centraliza a ponte nativa para que os componentes React nunca acessem
 * NativeModules diretamente — facilita testes (mock) e futura migração para
 * TurboModules (basta trocar a implementação deste arquivo).
 */
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { LocalMedia } from '../services/mediaUpload';

interface KeyboardBridgeNative {
  insertText(text: string): Promise<boolean>;
  deleteBackward(): Promise<boolean>;
  sendEnter(): Promise<boolean>;
  getInputContext?(): Promise<InputContext>;
  replaceTextBeforeCursor?(count: number, text: string): Promise<boolean>;
  switchKeyboard(): Promise<boolean>;
  setExpanded?(expanded: boolean): Promise<boolean>;
  setHeightMode?(mode: HeightMode): Promise<boolean>;
  hapticLongPress?(): Promise<boolean>;
  getTargetApp(): Promise<string | null>;
  isKeyboardContext(): Promise<boolean>;
  isKeyboardEnabled(): Promise<boolean>;
  isKeyboardSelected(): Promise<boolean>;
  openInputMethodPicker(): Promise<boolean>;
  openKeyboardSettings(): Promise<boolean>;
  // Só existem no Android (diagnóstico de carregamento do IME e envio de arquivos)
  notifyReady?(): void;
  reportError?(message: string): void;
  getContentMimeTypes?(): Promise<string[]>;
  commitImage?(url: string, description: string): Promise<CommitImageResult>;
  shareMedia?(urls: string[]): Promise<ShareResult>;
  shareWithCaption?(urls: string[], caption: string): Promise<ShareResult>;
  // Só no iPhone: o teclado precisa do "Acesso Total" para internet, dados do app e copiar fotos
  hasFullAccess?(): Promise<boolean>;
  prefetchMedia?(urls: string[]): Promise<number>;
  openApp?(): Promise<boolean>;
  openUrl?(url: string): Promise<boolean>;
  pickMedia?(source: KeyboardPickSource): Promise<LocalMedia | null>;
  requestMicPermission?(): Promise<MicPermission>;
  /** Android: o "voltar" do celular volta uma tela no teclado (true) ou fecha o teclado (false). */
  setBackEnabled?(enabled: boolean): void;
}

/** De onde o teclado pega o arquivo da seção Arquivos. */
/** Tamanho do teclado: normal, intermediário (Atalhos), tela grande ou tradução (normal + a faixa). */
export type HeightMode = 'normal' | 'tall' | 'expanded' | 'translate';

export type KeyboardPickSource = 'gallery' | 'gallery-photo' | 'camera-photo' | 'camera-video' | 'audio';

/** Resposta do pedido do microfone (blocked = negou com "não perguntar de novo"). */
export type MicPermission = 'granted' | 'denied' | 'blocked';

/**
 * sent = foto entregue na conversa; unsupported = o app só aceita texto (ou outro formato);
 * copied = iPhone: a foto foi copiada e a pessoa cola no campo (o iOS não deixa o teclado colocar imagem).
 */
export type CommitImageResult = 'sent' | 'unsupported' | 'failed' | 'copied';

/** direct/chooser = Android abriu o compartilhamento; copied = iPhone copiou o arquivo para colar. */
export type ShareResult = 'direct' | 'chooser' | 'copied';

/** Texto antes do cursor e tipo do campo (códigos do EditorInfo.inputType do Android). */
export interface InputContext {
  before: string;
  inputType: number;
}

/** Cursor mudou de lugar (no iOS vem sem posição). */
export interface SelectionChangeEvent {
  start?: number;
  end?: number;
}

export interface KeyboardShowEvent {
  targetPackage: string | null;
  restarting: boolean;
  inputType?: number;
}

const Native: KeyboardBridgeNative | undefined = NativeModules.KeyboardBridge;

if (!Native && __DEV__) {
  console.warn(
    `[KeyboardBridge] módulo nativo não encontrado (${Platform.OS}). ` +
      'Verifique se KeyboardBridgePackage foi registrado no MainApplication.',
  );
}

const emitter = Native ? new NativeEventEmitter(NativeModules.KeyboardBridge) : null;

const noop = async () => false;

/** Galeria/câmera aberta pelo teclado (o teclado some até ela fechar). */
let picking = false;
let pickingUntil = 0;
let activeUploads = 0;

export const KeyboardBridge = {
  /** Injeta texto no campo ativo (InputConnection.commitText / insertText). */
  insertText: (text: string) => (Native ? Native.insertText(text) : noop()),
  deleteBackward: () => (Native ? Native.deleteBackward() : noop()),
  sendEnter: () => (Native ? Native.sendEnter() : noop()),
  /** Texto antes do cursor + tipo do campo (maiúscula automática e sugestões). */
  getInputContext: (): Promise<InputContext> =>
    Native?.getInputContext ? Native.getInputContext() : Promise.resolve({ before: '', inputType: 1 }),
  /** Apaga `count` caracteres antes do cursor e insere `text` numa só edição. */
  replaceTextBeforeCursor: (count: number, text: string) =>
    Native?.replaceTextBeforeCursor ? Native.replaceTextBeforeCursor(count, text) : noop(),
  /** Volta ao teclado de digitação padrão (tecla 🌐). */
  switchKeyboard: () => (Native ? Native.switchKeyboard() : noop()),
  /** Teclado em tela grande (CRM) ou no tamanho normal. Volta ao normal sozinho a cada campo novo. */
  setExpanded: (expanded: boolean) => (Native?.setExpanded ? Native.setExpanded(expanded) : noop()),
  /** Normal, intermediário (um pouco mais alto, Atalhos) ou tela grande. */
  setHeightMode: (mode: HeightMode) =>
    Native?.setHeightMode ? Native.setHeightMode(mode) : Native?.setExpanded ? Native.setExpanded(mode === 'expanded') : noop(),
  /** Vibração curta de "pegou o item" (segurar para arrastar). Nunca falha. */
  hapticLongPress: () => {
    Native?.hapticLongPress?.().catch(() => {});
  },
  getTargetApp: () => (Native ? Native.getTargetApp() : Promise.resolve(null)),
  isKeyboardContext: () => (Native ? Native.isKeyboardContext() : Promise.resolve(false)),
  /** Verifica se o KEYCON está ativado no sistema */
  isKeyboardEnabled: () => (Native ? Native.isKeyboardEnabled() : Promise.resolve(false)),
  /** Verifica se o KEYCON é o teclado selecionado atualmente */
  isKeyboardSelected: () => (Native ? Native.isKeyboardSelected() : Promise.resolve(false)),
  /** Abre o seletor rápido de teclados do sistema */
  openInputMethodPicker: () => (Native ? Native.openInputMethodPicker() : noop()),
  /** Abre as configurações de teclado do sistema */
  openKeyboardSettings: () => (Native ? Native.openKeyboardSettings() : noop()),
  /** Avisa o lado nativo que a tela do teclado montou (some o "Carregando..."). */
  notifyReady: () => Native?.notifyReady?.(),
  /** Envia um erro JS para o diagnóstico exibido pelo teclado nativo. */
  reportError: (message: string) => Native?.reportError?.(message),
  /** Formatos de arquivo que o campo em foco aceita receber do teclado (vazio = só texto). */
  getContentMimeTypes: (): Promise<string[]> =>
    Native?.getContentMimeTypes ? Native.getContentMimeTypes() : Promise.resolve([]),
  /**
   * Baixa antes as mídias do catálogo e dos atalhos (Android), em segundo plano
   * e sem atrasar envios. Resolve com quantas já estão prontas no aparelho.
   */
  prefetchMedia: (urls: string[]): Promise<number> =>
    Native?.prefetchMedia ? Native.prefetchMedia(urls) : Promise.resolve(0),
  /** Baixa a foto e entrega direto na conversa (Android). */
  commitImage: (url: string, description: string): Promise<CommitImageResult> =>
    Native?.commitImage ? Native.commitImage(url, description) : Promise.resolve('unsupported'),
  /** Baixa os arquivos e abre o compartilhamento (prioriza o app em foco). */
  shareMedia: (urls: string[]): Promise<ShareResult> =>
    Native?.shareMedia
      ? Native.shareMedia(urls)
      : Promise.reject(new Error('Compartilhamento indisponível neste aparelho.')),

  /** O teclado consegue abrir a galeria e a câmera (Android)? No iPhone, só pelo app. */
  canPickMedia: !!Native?.pickMedia,
  /** O teclado pode usar o microfone (Android)? A Apple proíbe microfone em teclados. */
  canUseMic: !!Native?.requestMicPermission,
  /**
   * Abre a galeria ou a câmera por cima da conversa e devolve o arquivo no
   * aparelho (null = cancelou). O teclado some enquanto a galeria está aberta.
   */
  pickMedia: (source: KeyboardPickSource): Promise<LocalMedia | null> => {
    if (!Native?.pickMedia) return Promise.reject(new Error('No iPhone, adicione fotos, vídeos e áudios pelo app KEYCON.'));
    picking = true;
    pickingUntil = Date.now() + 60000;
    return Native.pickMedia(source).finally(() => {
      picking = false;
      // Carência de 3 s para o Android fechar a Activity e restaurar a janela do IME
      pickingUntil = Date.now() + 3000;
    });
  },
  /** A galeria/câmera está aberta ou o teclado ainda está voltando dela ou enviando arquivo? */
  isPickingMedia: () => picking || Date.now() < pickingUntil || activeUploads > 0,
  /** Marca que um upload de mídia está em andamento no teclado */
  setMediaUploading: (uploading: boolean) => {
    if (uploading) activeUploads++;
    else activeUploads = Math.max(0, activeUploads - 1);
  },
  /**
   * Permissão do microfone pedida de dentro do teclado (abre o pedido do
   * Android por cima da conversa; o teclado some até a pessoa responder).
   */
  requestMicPermission: (): Promise<MicPermission> => {
    if (!Native?.requestMicPermission) return Promise.resolve('denied');
    picking = true;
    pickingUntil = Date.now() + 60000;
    return Native.requestMicPermission().finally(() => {
      picking = false;
      pickingUntil = Date.now() + 3000;
    });
  },

  /**
   * Foto com legenda (ficha do produto): baixa e abre o compartilhamento com o
   * texto junto. No WhatsApp, a foto e o texto vão numa mensagem só.
   */
  shareWithCaption: (urls: string[], caption: string): Promise<ShareResult> =>
    Native?.shareWithCaption
      ? Native.shareWithCaption(urls, caption)
      : Promise.reject(new Error('Compartilhamento indisponível neste aparelho.')),

  /** Abre um link (ex.: a conversa do cliente no WhatsApp, https://wa.me/...). */
  openUrl: (url: string): Promise<boolean> =>
    Native?.openUrl ? Native.openUrl(url) : Promise.reject(new Error('Não foi possível abrir o link.')),

  /** Abre o app KEYCON (ex.: para fazer login). */
  openApp: (): Promise<boolean> => (Native?.openApp ? Native.openApp() : noop()),
  /** O teclado consegue abrir o app (Android)? No iPhone a Apple não deixa. */
  canOpenApp: !!Native?.openApp,
  /** iPhone: o "Acesso Total" está ligado? (no Android é sempre sim) */
  hasFullAccess: (): Promise<boolean> =>
    Native?.hasFullAccess ? Native.hasFullAccess().catch(() => true) : Promise.resolve(true),

  onKeyboardShow(cb: (e: KeyboardShowEvent) => void) {
    const sub = emitter?.addListener('onKeyboardShow', cb);
    return () => sub?.remove();
  },
  onKeyboardHide(cb: () => void) {
    const sub = emitter?.addListener('onKeyboardHide', cb);
    return () => sub?.remove();
  },
  onSelectionChange(cb: (e: SelectionChangeEvent) => void) {
    const sub = emitter?.addListener('onSelectionChange', cb);
    return () => sub?.remove();
  },
  onFocusDeviceField(cb: () => void) {
    const sub = emitter?.addListener('onFocusDeviceField', cb);
    return () => sub?.remove();
  },
  /** Alguma tela do teclado tem para onde voltar? (o Android então entrega o "voltar" ao JS) */
  setBackEnabled: (enabled: boolean) => Native?.setBackEnabled?.(enabled),
  /** "Voltar" do celular com uma tela do teclado aberta (só chega quando setBackEnabled(true)). */
  onBackPressed(cb: () => void) {
    const sub = emitter?.addListener('onBackPressed', cb);
    return () => sub?.remove();
  },
};

export const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];
