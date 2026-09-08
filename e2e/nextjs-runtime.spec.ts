import { expect, test } from "@playwright/test";

import { DESKTOP, loginAs, MOBILE, watchNextJsErrors } from "./helpers/media";

test.describe("Next.js overlay regressions", () => {
  test("chat hydrates on a phone without overlay errors", async ({ page }) => {
    const errors = watchNextJsErrors(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("media-pick-library")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    errors.assertNoOverlay();
  });

  test("chat hydrates on desktop without overlay errors", async ({ page }) => {
    const errors = watchNextJsErrors(page);
    await page.setViewportSize(DESKTOP);
    await loginAs(page, "Saad");
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await page.getByTestId("photo-attach").click();
    await expect(page.getByTestId("attach-sheet-desktop")).toBeVisible();
    await expect(page.getByTestId("media-pick-camera")).toBeVisible();
    errors.assertNoOverlay();
  });

  test("search results do not nest a div in a paragraph", async ({ page }) => {
    const errors = watchNextJsErrors(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    const token = `overlay-${Date.now()}`;
    const ok = await page.evaluate(async (text) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, clientGeneratedId: crypto.randomUUID() }),
      });
      return response.ok;
    }, `nextjs search ${token}`);
    expect(ok).toBe(true);

    await page.goto("/search");
    await expect(page.getByTestId("search-input")).toBeVisible();
    await page.getByTestId("search-input").fill(token);
    await expect(page.getByTestId("search-result").filter({ hasText: token })).toBeVisible({
      timeout: 15_000,
    });
    errors.assertNoOverlay();
  });

  test("media library loads without overlay errors", async ({ page }) => {
    const errors = watchNextJsErrors(page);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await page.goto("/media");
    await expect(page.getByTestId("media-library")).toBeVisible({ timeout: 30_000 });
    errors.assertNoOverlay();
  });
});
