/**
 * KeyboardBridge — versão WEB (usada só no site de testes, via Vite).
 *
 * No celular, o teclado escreve no campo do WhatsApp pelo Android/iOS. Na web,
 * a página de testes registra aqui um "host" (o campo de mensagem da conversa
 * simulada) e o teclado escreve nele. Mesma API do KeyboardBridge.ts.
 */
import type { LocalMedia } from '../services/mediaUpload';
import { captureWithCamera, pickAudioFile, pickFromGallery, pickPhotoOrVideo } from './MediaPicker';
import { IOS_SIMULATION } from './platformSim';
import { t } from '../i18n';

export interface KeyboardShowEvent {
  targetPackage: string | null;
  restarting: boolean;
  inputType?: number;
}

export type CommitImageResult = 'sent' | 'unsupported' | 'failed' | 'copied';

export type ShareResult = 'direct' | 'chooser' | 'copied';

export type HeightMode = 'normal' | 'tall' | 'expanded' | 'translate';

export type KeyboardPickSource = 'gallery' | 'gallery-photo' | 'camera-photo' | 'camera-video' | 'audio';

export type MicPermission = 'granted' | 'denied' | 'blocked';

export interface InputContext {
  before: string;
  inputType: number;
}

export interface SelectionChangeEvent {
  start?: number;
  end?: number;
}

/** Campo de texto que recebe o que o teclado digita (a conversa de teste). */
export interface WebKeyboardTarget {
  insert(text: string): void;
  /** Apaga 1 caractere; false quando não há o que apagar. */
  deleteBackward(): boolean;
  enter(): void;
  /** Texto antes do cursor no campo de teste. */
  textBeforeCursor(): string;
  /** Envia fotos/vídeos na conversa de teste (com legenda embaixo, como no WhatsApp). */
  sendMedia?(urls: string[], caption?: string): void;
}

let target: WebKeyboardTarget | null = null;
let openAppHandler: (() => void) | null = null;
let expandHandler: ((mode: HeightMode) => void) | null = null;
const showListeners = new Set<(e: KeyboardShowEvent) => void>();
const hideListeners = new Set<() => void>();
const selectionListeners = new Set<(e: SelectionChangeEvent) => void>();
const deviceFocusListeners = new Set<() => void>();
const backListeners = new Set<() => void>();
let backEnabled = false;

/** Usado pela página de testes para conectar a conversa simulada ao teclado. */
export const WebKeyboardHost = {
  attach(t: WebKeyboardTarget) {
    target = t;
    return () => {
      if (target === t) target = null;
    };
  },
  /** O teclado "apareceu" (recarrega catálogo, atalhos e login). */
  show() {
    showListeners.forEach(cb => cb({ targetPackage: 'com.whatsapp', restarting: false }));
  },
  hide() {
    hideListeners.forEach(cb => cb());
  },
  /** O usuário clicou ou focou no campo de texto do dispositivo (conversa). */
  focusDeviceField() {
    deviceFocusListeners.forEach(cb => cb());
  },
  /** O cursor do campo de teste mudou por fora do teclado (clique, colar...). */
  selectionChanged() {
    selectionListeners.forEach(cb => cb({}));
  },
  /** "Voltar" do celular (na página de teste: tecla Esc). true = o teclado voltou uma tela. */
  pressBack() {
    if (!backEnabled) return false;
    backListeners.forEach(cb => cb());
    return true;
  },
  /** O que fazer quando o teclado pede para abrir o app (ex.: login). */
  onOpenApp(handler: () => void) {
    openAppHandler = handler;
  },
  /** A página de teste aumenta a área do teclado (CRM e Agenda em tela grande). */
  onExpandedChange(handler: (mode: HeightMode) => void) {
    expandHandler = handler;
  },
};

/** Seletor de arquivos aberto pelo teclado (mesma API do KeyboardBridge.ts). */
let picking = false;
let pickingUntil = 0;
let activeUploads = 0;

const unavailable = (what: string) =>
  Promise.reject(new Error(t('{what} funciona só no celular. Use "segurar" para enviar o link.', { what: t(what) })));

export const KeyboardBridge = {
  insertText: async (text: string) => {
    if (!target) return false;
    target.insert(text);
    return true;
  },
  deleteBackward: async () => (target ? target.deleteBackward() : false),
  sendEnter: async () => {
    target?.enter();
    return !!target;
  },
  getInputContext: async (): Promise<InputContext> => ({
    before: target ? target.textBeforeCursor().slice(-200) : '',
    inputType: 1,
  }),
  replaceTextBeforeCursor: async (count: number, text: string) => {
    if (!target) return false;
    for (let i = 0; i < count; i++) target.deleteBackward();
    target.insert(text);
    return true;
  },
  // No celular, a tecla 🌐 troca para outro teclado do sistema
  switchKeyboard: async () => false,
  /** Página de teste: o teclado cresce sobre a conversa, como no celular. */
  setExpanded: async (expanded: boolean) => {
    expandHandler?.(expanded ? 'expanded' : 'normal');
    return !!expandHandler;
  },
  setHeightMode: async (mode: HeightMode) => {
    expandHandler?.(mode);
    return !!expandHandler;
  },
  /** No navegador do celular, a vibração da página (no computador não faz nada). */
  hapticLongPress: () => {
    (globalThis as { navigator?: { vibrate?: (ms: number) => boolean } }).navigator?.vibrate?.(30);
  },
  getTargetApp: async (): Promise<string | null> => (target ? 'com.whatsapp' : null),
  isKeyboardContext: async () => !!target,
  isKeyboardEnabled: async () => false,
  isKeyboardSelected: async () => false,
  openInputMethodPicker: async () => false,
  openKeyboardSettings: async () => false,
  notifyReady: () => {},
  reportError: (message: string) => console.error('[KEYCON]', message),
  // Na web o campo de teste só aceita texto: fotos caem no envio do link
  getContentMimeTypes: async (): Promise<string[]> => [],
  // Como no iPhone (?ios): o teclado copia o arquivo e a pessoa cola no campo
  // Conversa de teste: a foto (ou vídeo) chega como mensagem, com a legenda embaixo, como no WhatsApp.
  // No ?ios o teclado só copia o arquivo, como no iPhone.
  commitImage: async (url: string, _description: string): Promise<CommitImageResult> => {
    if (IOS_SIMULATION) return 'copied';
    if (!target?.sendMedia) return 'unsupported';
    target.sendMedia([url]);
    return 'sent';
  },
  shareMedia: (urls: string[]): Promise<ShareResult> => {
    if (IOS_SIMULATION) return Promise.resolve('copied');
    if (!target?.sendMedia) return unavailable('O compartilhamento de arquivos');
    target.sendMedia(urls);
    return Promise.resolve('direct');
  },
  shareWithCaption: (urls: string[], caption: string): Promise<ShareResult> => {
    if (IOS_SIMULATION) {
      target?.insert(caption);
      return Promise.resolve('copied');
    }
    if (!target?.sendMedia) return unavailable('O envio de foto com texto');
    target.sendMedia(urls, caption);
    return Promise.resolve('direct');
  },
  // Na web os arquivos não são guardados no aparelho
  prefetchMedia: async (_urls: string[]) => 0,
  // Na web o seletor de arquivos do navegador faz o papel da galeria (no iPhone o teclado não abre a galeria)
  canPickMedia: !IOS_SIMULATION,
  canUseMic: !IOS_SIMULATION,
  pickMedia: (source: KeyboardPickSource): Promise<LocalMedia | null> => {
    if (IOS_SIMULATION) return Promise.reject(new Error('No iPhone, adicione fotos, vídeos e áudios pelo app KEYCON.'));
    picking = true;
    pickingUntil = Date.now() + 60000;
    const pick =
      source === 'gallery'
        ? pickPhotoOrVideo()
        : source === 'gallery-photo'
          ? pickFromGallery('image')
          : source === 'audio'
            ? pickAudioFile()
            : captureWithCamera(source === 'camera-video' ? 'video' : 'image');
    return pick.finally(() => {
      picking = false;
      pickingUntil = Date.now() + 3000;
    });
  },
  isPickingMedia: () => picking || Date.now() < pickingUntil || activeUploads > 0,
  setMediaUploading: (uploading: boolean) => {
    if (uploading) activeUploads++;
    else activeUploads = Math.max(0, activeUploads - 1);
  },
  // Na web o próprio navegador pede o microfone ao gravar
  requestMicPermission: async (): Promise<MicPermission> => 'granted',
  // Na web, numa aba nova
  openUrl: async (url: string) => {
    (globalThis as { open?: (url: string, target: string) => unknown }).open?.(url, '_blank');
    return true;
  },
  openApp: async () => {
    openAppHandler?.();
    return !!openAppHandler;
  },
  canOpenApp: !IOS_SIMULATION,
  hasFullAccess: async () => true,

  onKeyboardShow(cb: (e: KeyboardShowEvent) => void) {
    showListeners.add(cb);
    return () => {
      showListeners.delete(cb);
    };
  },
  onKeyboardHide(cb: () => void) {
    hideListeners.add(cb);
    return () => {
      hideListeners.delete(cb);
    };
  },
  onSelectionChange(cb: (e: SelectionChangeEvent) => void) {
    selectionListeners.add(cb);
    return () => {
      selectionListeners.delete(cb);
    };
  },
  onFocusDeviceField(cb: () => void) {
    deviceFocusListeners.add(cb);
    return () => {
      deviceFocusListeners.delete(cb);
    };
  },
  setBackEnabled: (enabled: boolean) => {
    backEnabled = enabled;
  },
  onBackPressed(cb: () => void) {
    backListeners.add(cb);
    return () => {
      backListeners.delete(cb);
    };
  },
};

export const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];
