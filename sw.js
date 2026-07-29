/* Lumiere Magazine — service worker (offline + app install).
   Strategy:
     - HTML + code (js/css/manifest): network-first  -> updates always load when online,
       cache is only the offline fallback (no manual cache-busting needed).
     - Page images, icons, vendor lib: cache-first    -> instant + offline after first view.
   Bump CACHE only if you want to force-drop all cached images. */
const CACHE = "lumiere-complete-v12";
const SHELL = [
  "index.html",
  "flipbook.css",
  "flipbook.js",
  "vendor/page-flip.browser.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, key) {
  return fetch(req)
    .then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(key || req, clone));
      }
      return res;
    })
    .catch(() => caches.match(key || req));
}

function cacheFirst(req) {
  return caches.match(req).then(cached =>
    cached ||
    fetch(req).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    })
  );
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "index.html"));
    return;
  }

  const p = url.pathname;
  if (p.includes("/pages/") || p.includes("/icons/") || p.includes("/vendor/")) {
    event.respondWith(cacheFirst(req));
  } else {
    // flipbook.js, flipbook.css, manifest, etc. -> newest when online
    event.respondWith(networkFirst(req));
  }
});
