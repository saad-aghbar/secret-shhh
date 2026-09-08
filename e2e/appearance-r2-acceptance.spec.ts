import { expect, test } from "@playwright/test";

import { loginAndOpenAppearance, setPhotoFromCanvas } from "./helpers/appearance";
import { MOBILE } from "./helpers/media";

const isR2 = process.env.STORAGE_PROVIDER === "r2";

test.describe("appearance R2 acceptance", () => {
  test.skip(!isR2, "STORAGE_PROVIDER is not r2");

  test("signed wallpaper URL returns private bytes", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await setPhotoFromCanvas(page, { fill: "#4a756c" });
    await page.getByTestId("appearance-apply").click();
    await expect(page.getByTestId("appearance-apply")).toBeDisabled({ timeout: 60_000 });

    const signed = await page.evaluate(async () => {
      const appearance = await fetch("/api/appearance").then((response) => response.json());
      const assetId = appearance.resolved?.layer?.assetId as string | undefined;
      if (!assetId) return { ok: false, status: 0, url: "" };
      const response = await fetch(`/api/appearance/wallpaper/${assetId}/url`);
      const body = (await response.json()) as { url?: string };
      return { ok: response.ok, status: response.status, url: body.url ?? "" };
    });
    expect(signed.ok).toBe(true);
    expect(signed.url).toMatch(/^https?:\/\//);
    const asset = await page.request.get(signed.url);
    expect(asset.ok()).toBe(true);
    expect((await asset.body()).byteLength).toBeGreaterThan(0);
  });
});
