/**
 * Abrir o app numa aba: o teclado pede ("keycon://locker") e o app vai direto
 * para a aba. Sem login, o pedido fica guardado até a pessoa entrar.
 *
 * No Android o teclado abre o link keycon://locker (o app recebe pelo Linking).
 * Na página de teste (web), teclado e app rodam juntos: o pedido vai direto.
 */
import { Linking } from 'react-native';

export type AppLinkTab = 'files';

const LINKS: Record<string, AppLinkTab> = { locker: 'files' };

/** O link que abre o app na aba Locker. */
export const LOCKER_APP_LINK = 'keycon://locker';

let pending: AppLinkTab | null = null;
const listeners = new Set<(tab: AppLinkTab) => void>();

/** Pede para o app abrir a aba (agora, se o app estiver ouvindo; senão, ao abrir). */
export function requestAppTab(tab: AppLinkTab): void {
  if (listeners.size) listeners.forEach(fn => fn(tab));
  else pending = tab;
}

/** O app ouve os pedidos; recebe na hora o que ficou guardado. */
export function onAppTab(fn: (tab: AppLinkTab) => void): () => void {
  listeners.add(fn);
  if (pending) {
    const tab = pending;
    pending = null;
    fn(tab);
  }
  return () => {
    listeners.delete(fn);
  };
}

function handleUrl(url: string | null) {
  const m = url?.match(/^(?:keycon|com\.keycon\.app):\/\/([a-z-]+)/i);
  const tab = m ? LINKS[m[1].toLowerCase()] : undefined;
  if (tab) requestAppTab(tab);
}

/** Liga os links keycon://... (ao abrir o app e com ele aberto). */
export function startAppLinks(): () => void {
  Linking.getInitialURL()
    .then(handleUrl)
    .catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
  return () => sub.remove();
}
