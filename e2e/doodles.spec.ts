import { expect, test } from "@playwright/test";

import { drawHeart, openDoodleEditor, sendOpenDoodle } from "./helpers/doodles";
import { loginAs, MOBILE, scrollChatToLatest } from "./helpers/media";

test.describe("private doodles", () => {
  test("draw, send, receive, and persist after reload", async ({ browser }) => {
    test.setTimeout(180_000);
    const saadContext = await browser.newContext();
    const talaContext = await browser.newContext();
    const saad = await saadContext.newPage();
    const tala = await talaContext.newPage();
    await saad.setViewportSize(MOBILE);
    await tala.setViewportSize(MOBILE);
    await loginAs(saad, "Saad");
    await loginAs(tala, "Tala");

    await openDoodleEditor(saad);
    await expect(saad.getByTestId("doodle-send")).toBeDisabled();
    await saad.getByTestId("doodle-color").click();
    await saad.getByTestId("doodle-swatch-blush").click();
    await drawHeart(saad);
    await sendOpenDoodle(saad);

    const outgoing = saad.getByTestId("doodle-bubble").last();
    await expect(outgoing).toHaveAttribute("data-side", "outgoing");
    await expect(tala.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 45_000 });
    await expect(tala.getByTestId("doodle-bubble").last()).toHaveAttribute("data-side", "incoming");

    await saad.reload();
    await scrollChatToLatest(saad);
    await expect(saad.getByTestId("doodle-bubble").last()).toBeVisible({ timeout: 30_000 });

    await saadContext.close();
    await talaContext.close();
  });
});
