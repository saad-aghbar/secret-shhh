"use client";

import { useEffect } from "react";

const SW_ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";

async function unregisterWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("shhh-")).map((key) => caches.delete(key)));
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (!SW_ENABLED) {
      // Drop leftover workers from e2e (`NEXT_PUBLIC_ENABLE_SW=1`) so a down
      // or restarting `pnpm dev` cannot trap the tab on the /offline shell.
      void unregisterWorkers().catch(() => undefined);
      return;
    }
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined);

    const persist = navigator.storage?.persist;
    if (typeof persist === "function") {
      void persist.call(navigator.storage).catch(() => undefined);
    }
  }, []);

  return null;
}
