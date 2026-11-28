/**
 * Abrir o app numa aba: o teclado pede (botão da nuvem → aba Locker) e o app vai
 * direto para a aba. Sem login, o pedido fica guardado até a pessoa entrar.
 *
 * O pedido fica gravado no armazenamento que o app e o teclado dividem, e o app o
 * consome ao abrir e ao voltar para a frente. Assim ele chega mesmo quando o app
 * estava fechado: no Android o teclado roda no mesmo JavaScript do app, e o link
 * keycon://locker sozinho se perdia quando o app abria do zero (ele subia antes de
 * conseguir ler o link e ficava no Início). O link continua valendo (abre o app e
 * serve para quem chamar keycon://locker de fora).
 */
import { AppState, Linking } from 'react-native';
import { storage } from '../storage/storage';

export type AppLinkTab = 'files';

const LINKS: Record<string, AppLinkTab> = { locker: 'files' };
const TABS: readonly AppLinkTab[] = ['files'];

/** O link que abre o app na aba Locker. */
export const LOCKER_APP_LINK = 'keycon://locker';

const PENDING_KEY = 'app.pendingTab';
/** Pedido antigo (ex.: o app não abriu) não vale mais: não muda de aba do nada depois. */
const PENDING_TTL_MS = 2 * 60 * 1000;

const listeners = new Set<(tab: AppLinkTab) => void>();

/** Lê e apaga o pedido guardado (se ainda valer). */
function takePending(): AppLinkTab | null {
  const raw = storage.getString(PENDING_KEY);
  if (!raw) return null;
  storage.delete(PENDING_KEY);
  try {
    const { tab, at } = JSON.parse(raw) as { tab?: AppLinkTab; at?: number };
    if (tab && TABS.includes(tab) && typeof at === 'number' && Date.now() - at < PENDING_TTL_MS) return tab;
  } catch {
    // pedido estragado: ignora
  }
  return null;
}

/** Entrega o pedido guardado a quem está ouvindo (o app, logado e já depois do tutorial). */
function deliver() {
  if (!listeners.size) return;
  const tab = takePending();
  if (tab) listeners.forEach(fn => fn(tab));
}

/** Pede para o app abrir a aba (agora, se o app estiver ouvindo; senão, quando abrir). */
export function requestAppTab(tab: AppLinkTab): void {
  storage.set(PENDING_KEY, JSON.stringify({ tab, at: Date.now() }));
  deliver();
}

/** O app ouve os pedidos; recebe na hora o que ficou guardado. */
export function onAppTab(fn: (tab: AppLinkTab) => void): () => void {
  listeners.add(fn);
  deliver();
  return () => {
    listeners.delete(fn);
  };
}

function handleUrl(url: string | null) {
  const m = url?.match(/^(?:keycon|com\.keycon\.app):\/\/([a-z-]+)/i);
  const tab = m ? LINKS[m[1].toLowerCase()] : undefined;
  if (tab) requestAppTab(tab);
}

/** Liga os links keycon://... e confere o pedido guardado ao abrir e ao voltar para o app. */
export function startAppLinks(): () => void {
  Linking.getInitialURL()
    .then(handleUrl)
    .catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
  const appState = AppState.addEventListener('change', state => state === 'active' && deliver());
  return () => {
    sub.remove();
    appState.remove();
  };
}
