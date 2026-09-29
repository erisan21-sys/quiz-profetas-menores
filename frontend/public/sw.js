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

const VERSION = 'quiz-profetas-menores-v1.1.0';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE = `${VERSION}-api`;

// No plano gratuito do Render o servidor pode "adormecer" e levar até
// ~40-60s para responder de novo. Sem isso, trocar de tela ficaria travado
// nesse tempo todo mesmo já havendo dados recentes em cache. Por isso as
// leituras de API usam "stale-while-revalidate com prazo": se a rede não
// responder dentro de ALGUNS segundos e já existir algo em cache, mostramos
// o cache na hora e deixamos a rede atualizar em segundo plano.
const API_RACE_TIMEOUT_MS = 3500;

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
    event.respondWith(apiStaleWhileRevalidate(request, API_CACHE));
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

/**
 * Leituras de API (GET): tenta a rede, mas não trava a tela nela.
 *  • Sem nada em cache ainda: espera a rede normalmente (não há alternativa).
 *  • Já existe algo em cache: corre a rede contra um prazo curto; se a rede
 *    não vencer a tempo (ex.: servidor "acordando"), devolve o cache na hora
 *    e deixa a rede terminar/atualizar o cache em segundo plano.
 */
async function apiStaleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      notifyClients({ type: 'sw:online' });
      return response;
    })
    .catch((err) => {
      notifyClients({ type: 'sw:offline' });
      throw err;
    });

  if (!cached) {
    return networkPromise;
  }

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(undefined), API_RACE_TIMEOUT_MS);
  });

  const winner = await Promise.race([networkPromise.catch(() => undefined), timeout]);
  if (winner) return winner;

  // A rede demorou mais que o prazo: devolve o cache agora. A promise da
  // rede continua rodando sozinha e, se responder, já deixa o cache pronto
  // para a próxima navegação — sem nunca sobrepor a tela atual.
  networkPromise.catch(() => undefined);
  return cached;
}

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
