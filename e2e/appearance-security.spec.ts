import { expect, test } from "@playwright/test";

import { putAppearanceViaApi } from "./helpers/appearance";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("appearance security", () => {
  test("rejects CSS injection, unknown versions, and spoofed assets", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    const cases = [
      { version: 99, type: "solid", color: "#4a756c", blur: 0, dim: 0, overlay: 0, focalX: 0.5, focalY: 0.5, zoom: 1 },
      {
        version: 1,
        type: "solid",
        color: "url(javascript:alert(1))",
        blur: 0,
        dim: 0,
        overlay: 0,
        focalX: 0.5,
        focalY: 0.5,
        zoom: 1,
      },
      {
        version: 1,
        type: "solid",
        color: "#4a756c",
        blur: Number.NaN,
        dim: 0,
        overlay: 0,
        focalX: 0.5,
        focalY: 0.5,
        zoom: 1,
      },
      {
        version: 1,
        type: "image",
        assetId: "00000000-0000-4000-8000-000000000000",
        blur: 0,
        dim: 0,
        overlay: 0,
        focalX: 0.5,
        focalY: 0.5,
        zoom: 1,
      },
    ];

    for (const body of cases) {
      const result = await putAppearanceViaApi(page, "personal", body);
      expect(result.ok).toBe(false);
      expect(result.status).toBeGreaterThanOrEqual(400);
    }
  });
});
