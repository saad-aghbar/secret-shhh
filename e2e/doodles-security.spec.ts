import { expect, test } from "@playwright/test";

import { loginAs, MOBILE } from "./helpers/media";

test.describe("doodle security", () => {
  test("rejects CSS injection, unknown versions, and NaN", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");

    const cases = [
      {
        version: 1,
        aspectRatio: 0.8,
        backgroundMode: "paper",
        strokes: [
          {
            id: "x",
            tool: "pen",
            color: "url(javascript:alert(1))",
            width: 0.02,
            opacity: 1,
            points: [0.1, 0.1, 0.5],
          },
        ],
      },
      {
        version: 99,
        aspectRatio: 0.8,
        backgroundMode: "paper",
        strokes: [
          { id: "x", tool: "pen", color: "#4a756c", width: 0.02, opacity: 1, points: [0.1, 0.1, 0.5] },
        ],
      },
      {
        version: 1,
        aspectRatio: 0.8,
        backgroundMode: "paper",
        strokes: [
          {
            id: "x",
            tool: "pen",
            color: "#4a756c",
            width: Number.NaN,
            opacity: 1,
            points: [0.1, 0.1, 0.5],
          },
        ],
      },
    ];

    for (const doodle of cases) {
      const status = await page.evaluate(async (payload) => {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doodle: payload, clientGeneratedId: crypto.randomUUID() }),
        });
        return response.status;
      }, doodle);
      expect(status, JSON.stringify(doodle.version)).toBe(400);
    }

    const missing = await page.evaluate(async () => {
      const response = await fetch(`/api/doodles/${crypto.randomUUID()}`, { cache: "no-store" });
      return response.status;
    });
    expect(missing).toBe(404);
  });
});
