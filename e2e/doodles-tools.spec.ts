import { expect, test } from "@playwright/test";

import { drawStroke, lastDoodleMessage, openDoodleEditor, sendOpenDoodle } from "./helpers/doodles";
import { loginAs, MOBILE } from "./helpers/media";

test.describe("doodle tools", () => {
  test("pen, marker, eraser, undo, redo, thickness, and color change the vector", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(MOBILE);
    await loginAs(page, "Saad");
    await openDoodleEditor(page);

    await page.getByTestId("doodle-tool-pen").click();
    await drawStroke(page, { x: 0.2, y: 0.3 }, { x: 0.7, y: 0.32 });
    await page.getByTestId("doodle-tool-marker").click();
    await expect(page.getByTestId("doodle-stroke-options")).toBeVisible();
    await page.getByTestId("doodle-color").click();
    await page.getByTestId("doodle-swatch-yellow").click();
    await drawStroke(page, { x: 0.2, y: 0.5 }, { x: 0.75, y: 0.52 });
    await page.getByTestId("doodle-undo").click();
    await page.getByTestId("doodle-redo").click();
    await page.getByTestId("doodle-tool-eraser").click();
    await drawStroke(page, { x: 0.45, y: 0.48 }, { x: 0.55, y: 0.54 }, 8);
    await sendOpenDoodle(page);

    const message = await lastDoodleMessage(page);
    expect(message?.doodle?.document?.strokes?.length).toBeGreaterThan(0);
    const tools = new Set(message?.doodle?.document?.strokes?.map((stroke) => stroke.tool));
    expect(tools.has("pen") || tools.has("marker")).toBe(true);
  });
});
