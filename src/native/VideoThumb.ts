/**
 * Capa dos vídeos do Locker (app e teclado): um quadro do começo do vídeo, gerado
 * no aparelho (Android: VideoThumbModule.kt; iPhone: ios/Shared/KeyconVideoThumb.m)
 * e guardado no cache. Sem o módulo nativo ou sem conseguir ler o vídeo: null, e a
 * tela mostra o ícone de vídeo como antes.
 */
import { NativeModules } from 'react-native';

interface VideoThumbNative {
  thumbnail(url: string, key: string): Promise<string | null>;
}

const Native: VideoThumbNative | undefined = NativeModules.KeyconVideoThumb;

/** Já pedidas nesta abertura: a mesma capa não é gerada duas vezes. */
const cache = new Map<string, Promise<string | null>>();

/** "file://..." da capa, ou null. `key` identifica o vídeo (não muda quando o link é renovado). */
export function videoThumbnail(url: string, key: string): Promise<string | null> {
  if (!Native || !url) return Promise.resolve(null);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = Native.thumbnail(url, key).catch(() => null);
  cache.set(key, pending);
  // Falhou (ex.: sem internet): tenta de novo na próxima vez que a tela abrir
  pending.then(uri => {
    if (!uri) cache.delete(key);
  });
  return pending;
}
