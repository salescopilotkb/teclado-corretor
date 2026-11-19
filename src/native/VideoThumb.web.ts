/**
 * Capa dos vídeos — versão WEB (site de testes): o navegador abre o vídeo, vai a
 * ~1 s e desenha o quadro num canvas. Vídeos de outro site sem permissão (CORS)
 * não deixam ler o quadro: aí fica o ícone de vídeo.
 */
const cache = new Map<string, Promise<string | null>>();
const MAX_SIDE = 480;

function grab(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const doc = (globalThis as { document?: any }).document;
    if (!doc) {
      resolve(null);
      return;
    }
    const video = doc.createElement('video');
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      video.removeAttribute('src');
      video.load?.();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 15000);
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight, 1));
        const canvas = doc.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        finish(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        clearTimeout(timer);
        finish(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    video.src = url;
  });
}

export function videoThumbnail(url: string, key: string): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = grab(url);
  cache.set(key, pending);
  pending.then(uri => {
    if (!uri) cache.delete(key);
  });
  return pending;
}
