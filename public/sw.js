// Ditto — service worker
// Estratégia conservadora: só cacheia assets estáticos (JS/CSS/fontes/ícones).
// Nunca intercepta chamadas ao Supabase nem métodos que não sejam GET,
// pra não arriscar servir dados de tarefas/listas desatualizados ou offline.

const CACHE_NAME = "ditto-static-v1";
const STATIC_DESTINATIONS = new Set(["script", "style", "font", "image"]);

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET, só mesma origem, nunca Supabase/APIs externas.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação (HTML): network-first, sem fallback de cache — evita mostrar
  // uma versão antiga da tela quando o usuário está online mas a rede falhou
  // por um instante, e evita quebrar o roteamento/autenticação do TanStack Start.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Assets estáticos: cache-first, com atualização em segundo plano (stale-while-revalidate).
  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
