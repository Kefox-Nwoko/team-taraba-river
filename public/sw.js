/* Team Taraba River — Service Worker
 * Provides an offline-capable app shell and aggressive static-asset caching
 * so the portal stays fast and usable on poor / flaky networks.
 *
 * Strategy:
 *  - Navigation requests  -> network-first, fall back to cached shell
 *  - Static assets (js/css/img/font/svg/woff) -> stale-while-revalidate
 *  - API requests (/api/*) -> always network (never cache auth/tokens)
 */
const CACHE_VERSION = "taraba-river-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.match(
      /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|json|mp4|webm|ogg)(?:[?#]|$)/i
    ) != null
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls (they carry auth tokens / dynamic data)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network-first, fall back to cached shell when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/index.html");
        })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
