// App-shell service worker. Two strategies, deliberately not one
// generic "cache everything" handler:
//
//  - Static assets (JS/CSS/fonts/icons): cache-first. These are
//    content-hashed at build time, so a cache hit is always correct
//    and costs zero network round-trips on repeat visits.
//  - API GET calls: network-first with a cache fallback. Freshness
//    matters more than speed for data, but a flaky connection on a
//    shared classroom Wi-Fi shouldn't blank the screen — the IndexedDB
//    SWR layer (useCachedQuery) is the primary cache for data; this is
//    the last-resort net when that layer's own fetch has no network at
//    all to retry against.
const SHELL_CACHE = "shell-v1";
const API_CACHE = "api-v1";
const SHELL_ASSETS = ["/", "/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== API_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  const isStaticAsset = /\.(js|css|woff2?|svg|png|webp)$/.test(url.pathname);
  const isApi = url.pathname.startsWith("/api/") || url.pathname.startsWith("/public/");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (isApi) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(API_CACHE).then((c) => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/offline.html"))),
    );
    return;
  }

  // Navigations: try the network, fall back to the cached shell so the
  // app still opens — with its own in-app offline state — on a dead
  // connection rather than showing the browser's error page.
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/") ?? caches.match("/offline.html")),
  );
});
