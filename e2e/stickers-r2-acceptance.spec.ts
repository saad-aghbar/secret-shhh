import { expect, test } from "@playwright/test";

import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";
import { createStickerViaApi } from "./helpers/stickers";

const isR2 = process.env.STORAGE_PROVIDER === "r2";

test.describe("sticker R2 acceptance", () => {
  test.skip(!isR2, "STORAGE_PROVIDER is not r2");

  test("signed sticker URL returns bytes from private storage", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const stickerId = await createStickerViaApi(page, `r2 ${Date.now().toString(36)}`);
    const sent = await page.evaluate(async (id) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stickerId: id, clientGeneratedId: crypto.randomUUID() }),
      });
      return response.ok;
    }, stickerId);
    expect(sent).toBe(true);
    await scrollChatToLatest(page);
    await expect(page.getByTestId("sticker-bubble").last()).toBeVisible({ timeout: 30_000 });

    const signed = await page.evaluate(async (id) => {
      const response = await fetch(`/api/stickers/${id}/url`);
      const body = (await response.json()) as { url?: string };
      return { ok: response.ok, status: response.status, url: body.url ?? "" };
    }, stickerId);
    expect(signed.ok).toBe(true);
    expect(signed.url).toMatch(/^https?:\/\//);
    const asset = await page.request.get(signed.url);
    expect(asset.ok()).toBe(true);
    expect((await asset.body()).byteLength).toBeGreaterThan(0);

    const loaded = await page.getByTestId("sticker-bubble").last().locator("img").evaluate((node) => {
      const img = node as HTMLImageElement;
      return img.naturalWidth > 0 && img.complete;
    });
    expect(loaded).toBe(true);
  });
});
