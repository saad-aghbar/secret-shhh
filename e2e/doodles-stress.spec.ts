import { expect, test } from "@playwright/test";

import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

test.describe("doodle stress", () => {
  test("sends a dense doodle and rejects an oversized payload", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    const dense = await page.evaluate(async () => {
      const strokes = Array.from({ length: 80 }, (_, index) => ({
        id: `s-${index}`,
        tool: "pen" as const,
        color: "#4a756c",
        width: 0.016,
        opacity: 1,
        points: [0.1, 0.1 + index * 0.008, 0.5, 0.8, 0.12 + index * 0.008, 0.5],
      }));
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doodle: { version: 1, aspectRatio: 0.8, backgroundMode: "paper", strokes },
          clientGeneratedId: crypto.randomUUID(),
        }),
      });
      return response.ok;
    });
    expect(dense).toBe(true);
    await scrollChatToLatest(page);
    await expect(page.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 20_000 });

    const oversized = await page.evaluate(async () => {
      const points = Array.from({ length: 21_000 * 3 }, (_, i) => (i % 3 === 2 ? 0.5 : (i % 90) / 100));
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doodle: {
            version: 1,
            aspectRatio: 0.8,
            backgroundMode: "paper",
            strokes: [{ id: "huge", tool: "pen", color: "#4a756c", width: 0.02, opacity: 1, points }],
          },
          clientGeneratedId: crypto.randomUUID(),
        }),
      });
      return response.status;
    });
    expect(oversized).toBe(400);
  });
});
