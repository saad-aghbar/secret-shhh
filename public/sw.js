/* Shhh service worker — app shell only.
 * Never caches /api, authenticated HTML, signed media URLs, or tokens.
 * Production: a new worker activates on the next cold start (no skipWaiting).
 * Localhost: skipWaiting + claim, and never cache `/_next`, so leftover e2e
 * workers cannot pin stale Turbopack chunks. Visible notification and badge
 * handlers are omitted on purpose.
 */

const SHELL_CACHE = "shhh-shell-v3";
const ASSET_CACHE = "shhh-assets-v3";
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE];

const PRECACHE = ["/offline", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

function isLocalDev() {
  const host = self.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

self.addEventListener("install", (event) => {
  if (isLocalDev()) {
    self.skipWaiting();
  }
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("shhh-") && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      if (isLocalDev()) {
        await self.clients.claim();
      }
    })(),
  );
});

function isGet(request) {
  return request.method === "GET";
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApi(url) {
  return url.pathname === "/api" || url.pathname.startsWith("/api/");
}

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isHashedAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/icon-maskable-512.png" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  );
}

function isPassthrough(url) {
  return (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/sw-reset.html" ||
    (isLocalDev() && url.pathname.startsWith("/_next/"))
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isGet(request)) {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!isSameOrigin(url) || isApi(url) || isPassthrough(url)) {
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirstAsset(request));
  }
});

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match("/offline");
    if (cached) return cached;
    return new Response("Shhh is offline.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
