import { expect, type Page } from "@playwright/test";

import { loginAs, password } from "./media";

export { password };

export async function hideDocument(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(Document.prototype, "visibilityState", {
      configurable: true,
      get() {
        return "hidden";
      },
    });
    Object.defineProperty(Document.prototype, "hidden", {
      configurable: true,
      get() {
        return true;
      },
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

export async function showDocument(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(Document.prototype, "visibilityState", {
      configurable: true,
      get() {
        return "visible";
      },
    });
    Object.defineProperty(Document.prototype, "hidden", {
      configurable: true,
      get() {
        return false;
      },
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

export async function unlockShhh(page: Page, value = password) {
  await page.getByTestId("lock-screen").getByLabel("Password").fill(value);
  await page.getByTestId("unlock-shhh").click();
}

export async function openPrivacy(page: Page, name: "Saad" | "Tala" = "Saad") {
  await loginAs(page, name);
  await page.goto("/more/privacy");
  await expect(page.getByTestId("privacy-page")).toBeVisible();
}

export async function readServiceWorkerCaches(page: Page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        urls.push(request.url);
      }
    }
    return { names, urls };
  });
}
