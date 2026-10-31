/**
 * Service worker do Locker web: guarda a página para abrir sem internet.
 *  - páginas: busca na rede; sem conexão, abre a última guardada;
 *  - /assets/ (nomes com hash, nunca mudam): do cache primeiro;
 *  - fontes do Google: do cache primeiro.
 * Dados (Supabase) e arquivos (R2) não passam por aqui: o próprio Locker guarda a
 * última cópia e os arquivos marcados "Disponível sem internet" (src/offline.ts).
 */
const SHELL = 'locker-shell-v1';
const PRECACHE = ['/', '/index.html', '/favicon.png', '/k-mark.png', '/logo-keycon.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('locker-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (request, response) => {
  if (!response || !response.ok) return response;
  const copy = response.clone();
  caches.open(SHELL).then(cache => cache.put(request, copy));
  return response;
};

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Página (também /f/... e /d/...): rede primeiro, a guardada se cair
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then(response => put('/index.html', response))
          .catch(() => caches.match('/index.html')),
      );
      return;
    }
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => put(request, response))));
      return;
    }
    // Ícones e o resto: a guardada na hora, e atualiza por trás
    event.respondWith(
      caches.match(request).then(hit => {
        const network = fetch(request)
          .then(response => put(request, response))
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => put(request, response))));
  }
});
