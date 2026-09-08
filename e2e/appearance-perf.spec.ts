import { expect, test } from "@playwright/test";

import { applyPersonalColor, loginAndOpenAppearance } from "./helpers/appearance";
import { MOBILE, scrollChatToLatest } from "./helpers/media";

test.describe("appearance perf", () => {
  test("wallpaper layer does not block chat scrolling", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAndOpenAppearance(page, "Saad");
    await applyPersonalColor(page, "sage");
    await page.goto("/chat");
    await expect(page.getByTestId("chat-experience")).toBeVisible();
    await scrollChatToLatest(page);
    const pointer = await page.getByTestId("wallpaper-layer").evaluate((node) => {
      return window.getComputedStyle(node).pointerEvents;
    });
    expect(pointer).toBe("none");
    await expect(page.getByTestId("chat-message-list")).toBeVisible();
  });
});
