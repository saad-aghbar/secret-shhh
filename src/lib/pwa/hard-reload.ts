/** Drop leftover workers/caches, then do a real navigation — not error-boundary retry. */
export async function hardReloadApp() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((name) => caches.delete(name)));
    }
  } catch {
    // Still reload; a stale tab is worse than a leftover worker.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}
