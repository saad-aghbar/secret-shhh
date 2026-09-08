import { expect, type Page } from "@playwright/test";

import { loginAndOpenAppearance, openAppearance } from "./appearance";

export async function resetThemeState(page: Page) {
  await page.evaluate(async () => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("shhh.theme")) window.localStorage.removeItem(key);
    }
    await fetch("/api/theme?target=light", { method: "DELETE" });
    await fetch("/api/theme?target=dark", { method: "DELETE" });
    await fetch("/api/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "system" }),
    });
  });
}

export async function openThemeEditor(page: Page, target: "light" | "dark") {
  await expect(page.getByTestId("theme-entries")).toBeVisible();
  await page.getByTestId(`theme-customize-${target}`).click();
  await expect(page.getByTestId("theme-editor")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("theme-app-preview")).toBeVisible();
}

export async function loginAndOpenThemeEditor(
  page: Page,
  name: "Saad" | "Tala",
  target: "light" | "dark" = "light",
) {
  await loginAndOpenAppearance(page, name);
  await resetThemeState(page);
  await openAppearance(page, { reset: false });
  await openThemeEditor(page, target);
}

export async function applyThemePreset(page: Page, presetId: string) {
  await page.getByTestId(`theme-preset-${presetId}`).click();
  await page.getByTestId("theme-apply").click();
  await expect(page.getByTestId("theme-apply")).toBeDisabled({ timeout: 20_000 });
}

export async function accentValue(page: Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--shhh-accent").trim(),
  );
}

export async function outgoingValue(page: Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--shhh-outgoing").trim(),
  );
}

export async function cssVar(page: Page, name: string) {
  return page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  );
}

export async function putThemeViaApi(
  page: Page,
  target: "light" | "dark",
  config: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ dest, body }) => {
      const response = await fetch("/api/theme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: dest, config: body }),
      });
      return { status: response.status, ok: response.ok };
    },
    { dest: target, body: config },
  );
}

export const EXTREME_LIGHT_THEME = {
  version: 1,
  preset: "shhh",
  colors: {
    accent: "#d0d0d0",
    background: "#fffef0",
    surface: "#ffffff",
    outgoing: "#ffff00",
    incoming: "#fefefe",
    navSurface: "#ffffff",
    navSelected: "#d0d0d0",
    button: "#d0d0d0",
    composer: "#ffffff",
    sheet: "#ffffff",
  },
};
