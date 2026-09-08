import { expect, test } from "@playwright/test";

import { readServiceWorkerCaches } from "./helpers/privacy";
import { loginAs, sendPhotos, fixtureJpeg } from "./helpers/media";

test.describe("pwa", () => {
  test("manifest is discreet and installable", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const manifest = (await response.json()) as {
      name?: string;
      short_name?: string;
      id?: string;
      start_url?: string;
      display?: string;
      description?: string;
      icons?: Array<{ sizes?: string; purpose?: string }>;
    };
    expect(manifest.name).toBe("Shhh");
    expect(manifest.short_name).toBe("Shhh");
    expect(manifest.id ?? manifest.start_url).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.description).toBeUndefined();
    expect(manifest.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
  });

  test("service worker is not cached and never stores API responses", async ({ page }) => {
    test.setTimeout(120_000);
    const sw = await page.request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    expect(sw.headers()["cache-control"] ?? "").toMatch(/no-store|no-cache/);
    const source = await sw.text();
    expect(source).toMatch(/function isLocalDev/);
    expect(source).toMatch(/if\s*\(\s*isLocalDev\(\)\s*\)\s*\{\s*self\.skipWaiting\(\)/);
    expect(source).not.toMatch(/showNotification\s*\(/);
    expect(source).not.toMatch(/addEventListener\(\s*["']push["']/);
    expect(source).not.toMatch(/addEventListener\(\s*["']notificationclick["']/);

    await loginAs(page, "Saad");
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const ready = await navigator.serviceWorker.ready;
            return Boolean(ready.active);
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.reload();
    await expect
      .poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
        timeout: 20_000,
      })
      .toBe(true);

    await sendPhotos(page, fixtureJpeg, `pwa-sw ${Date.now()}`);
    const caches = await readServiceWorkerCaches(page);
    expect(caches.names.every((name) => name.startsWith("shhh-"))).toBe(true);
    expect(caches.urls.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(false);
  });

  test("offline navigation shows the Shhh shell, not a browser error page", async ({ page, context }) => {
    test.setTimeout(90_000);
    await loginAs(page, "Saad");
    await expect
      .poll(async () => page.evaluate(async () => Boolean(await caches.match("/offline"))), {
        timeout: 20_000,
      })
      .toBe(true);
    await context.setOffline(true);
    await page.goto("/chat", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("offline-shell")).toBeVisible();
    await expect(page.getByText("You’re offline")).toBeVisible();
    await context.setOffline(false);
  });
});
