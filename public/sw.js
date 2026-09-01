/* Team Taraba River — High-Performance Zero-Bloat Service Worker v4
 * Complies with Silicon Valley PWA standards:
 * - Instant offline-capable app shell
 * - Stale-while-revalidate for static code/icons
 * - STRICT EXCLUSION of heavy video/audio streaming (prevents disk bloat)
 * - LRU runtime cache cap (max 40 items) to guarantee zero memory/storage clogging
 * - In-app cache clearance IPC message handling
 */

const CACHE_VERSION = "taraba-river-v4";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const MAX_RUNTIME_ITEMS = 40;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon-32.png",
  "/favicon-64.png",
  "/favicon.png"
];

// Helper: Trim cache to max items (LRU policy)
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const itemsToDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
    }
  } catch (e) {
    // Non-critical cache trim error
  }
}

// 1. Install Phase — Precache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

// 2. Activation Phase — Clean up old caches
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

// Helper: Check if URL is an excluded streaming / large media file
function isStreamingMedia(url) {
  return (
    url.pathname.match(/\.(?:mp4|webm|ogg|m4v|mov|avi|m3u8|mpd|wav|flac)(?:[?#]|$)/i) != null ||
    url.hostname.includes("youtube.com") ||
    url.hostname.includes("googlevideo.com") ||
    url.hostname.includes("ytimg.com")
  );
}

// Helper: Check if URL is a cacheable static bundle/asset
function isCacheableStaticAsset(url) {
  if (isStreamingMedia(url)) return false;
  return (
    url.pathname.match(/\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|json)(?:[?#]|$)/i) != null
  );
}

// 3. Fetch Handler — Zero-Bloat caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls (auth, real-time database, cloud functions)
  if (url.pathname.startsWith("/api/")) return;

  // Never intercept or cache heavy streaming video or video CDNs
  if (isStreamingMedia(url)) return;

  // Navigation requests: Network-first, fall back to cached app shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/index.html") || caches.match("/");
        })
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate with LRU limits
  if (url.origin === self.location.origin && isCacheableStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then(async (cache) => {
                await cache.put(request, copy);
                trimCache(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
              });
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});

// 4. Client IPC Message Listener (For In-App Cache Cleaner)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "CLEAR_ALL_CACHES") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      });
  } else if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
