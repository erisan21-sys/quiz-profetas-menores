/* ==========================================================================
 * QUIZ BÍBLICO — PROFETAS MENORES · Service Worker (PWA)
 * --------------------------------------------------------------------------
 * Estratégia:
 *  • assets estáticos  -> cache-first com atualização em segundo plano
 *  • navegação (HTML)  -> network-first, caindo para o cache quando offline
 *  • GET /api/*        -> network-first + cópia em cache (leitura offline)
 *  • POST /api/*       -> NUNCA interceptado (pontuação oficial é online)
 *
 * Nenhuma pontuação é registrada offline: o SW apenas preserva a interface e
 * os dados de leitura. O app avisa o usuário e sincroniza quando reconecta.
 * ========================================================================== */

const VERSION = 'quiz-profetas-menores-v1.0.0';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Notifica a interface quando o estado online/offline muda de fato. */
function notifyClients(payload) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage(payload));
  });
}

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // POST/PUT/DELETE seguem sempre para a rede

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith('/api/');
  const isNavigation = request.mode === 'navigate';

  if (isApi) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isNavigation) {
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(async () => {
        const cached = await caches.match('/index.html');
        return cached || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
      }),
    );
    return;
  }

  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    notifyClients({ type: 'sw:online' });
    return response;
  } catch (err) {
    notifyClients({ type: 'sw:offline' });
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
