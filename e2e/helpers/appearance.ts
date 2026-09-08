import { expect, type Page } from "@playwright/test";

import { loginAs } from "./media";

export async function resetAppearanceState(page: Page) {
  await page.evaluate(async () => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("shhh.appearance.draft")) window.localStorage.removeItem(key);
    }
    await fetch("/api/appearance/personal", { method: "DELETE" });
    await fetch("/api/appearance/shared", { method: "DELETE" });
  });
}

export async function openAppearance(page: Page, options?: { reset?: boolean }) {
  await page.goto("/more");
  await expect(page.getByTestId("appearance-entry")).toBeVisible({ timeout: 20_000 });
  if (options?.reset !== false) {
    await resetAppearanceState(page);
  }
  await page.getByTestId("appearance-entry").click();
  await expect(page.getByTestId("appearance-page")).toBeVisible({ timeout: 20_000 });
}

export async function loginAndOpenAppearance(
  page: Page,
  name: "Saad" | "Tala",
  options?: { reset?: boolean },
) {
  await loginAs(page, name);
  await openAppearance(page, options);
}

export async function selectAppearanceMode(page: Page, mode: "Personal" | "Shared") {
  await page.getByTestId("appearance-mode").getByRole("radio", { name: mode }).click();
}

export async function applyPersonalColor(page: Page, presetId = "sage") {
  await selectAppearanceMode(page, "Personal");
  await page.getByTestId(`appearance-preset-${presetId}`).click();
  await page.getByTestId("appearance-apply").click();
  await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
}

export async function applySharedColor(page: Page, presetId = "clay") {
  await selectAppearanceMode(page, "Shared");
  await page.getByTestId(`appearance-preset-${presetId}`).click();
  await page.getByTestId("appearance-apply").click();
  await expect(page.getByTestId("shhh-modal")).toBeVisible();
  await page.getByTestId("appearance-shared-confirm").click();
  await expect(page.getByTestId("shhh-modal")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 20_000 });
}

export async function wallpaperType(page: Page) {
  return page.getByTestId("wallpaper-layer").getAttribute("data-type");
}

export async function wallpaperSource(page: Page) {
  return page.getByTestId("wallpaper-layer").getAttribute("data-source");
}

export async function setPhotoFromCanvas(
  page: Page,
  paint: {
    fill?: string;
    busy?: boolean;
    nearWhite?: boolean;
    nearBlack?: boolean;
    fileName?: string;
    mimeType?: string;
  },
) {
  await page.getByTestId("appearance-preset-photo").click();
  await expect(page.getByTestId("appearance-photo-input")).toBeAttached();
  await page.evaluate(async (spec) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    if (spec.busy) {
      for (let y = 0; y < 10; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          ctx.fillStyle = `hsl(${(x * 47 + y * 19) % 360} 70% ${30 + ((x + y) % 5) * 10}%)`;
          ctx.fillRect(x * 100, y * 100, 100, 100);
        }
      }
    } else if (spec.nearWhite) {
      ctx.fillStyle = "#f7f4ef";
      ctx.fillRect(0, 0, 800, 1000);
    } else if (spec.nearBlack) {
      ctx.fillStyle = "#161310";
      ctx.fillRect(0, 0, 800, 1000);
    } else {
      ctx.fillStyle = spec.fill ?? "#4a756c";
      ctx.fillRect(0, 0, 800, 1000);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no blob");
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="appearance-photo-input"]',
    );
    if (!input) throw new Error("no input");
    const file = new File([blob], spec.fileName ?? "wallpaper.png", {
      type: spec.mimeType ?? "image/png",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, paint);
  await expect(page.getByTestId("appearance-photo-crop").locator("img")).toBeVisible({
    timeout: 30_000,
  });
}

export async function putAppearanceViaApi(
  page: Page,
  target: "personal" | "shared",
  body: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ target: dest, body: payload }) => {
      const response = await fetch(`/api/appearance/${dest}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { status: response.status, ok: response.ok };
    },
    { target, body },
  );
}
