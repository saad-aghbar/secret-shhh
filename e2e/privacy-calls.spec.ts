import { expect, test } from "@playwright/test";

import { openTwoUsers, startCall, waitForIncoming } from "./helpers/calls";
import { hideDocument, showDocument, unlockShhh } from "./helpers/privacy";
import { activeCall, expectAudioExchange, waitForMediaDebug } from "./helpers/livekit";

test.describe("privacy calls", () => {
  test("an active call survives hide, lock, and unlock", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await expect(saad.getByTestId("chat-experience")).toBeVisible({ timeout: 20_000 });
      await expect(saad.getByTestId("lock-screen")).toHaveCount(0);
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await expectAudioExchange(saad, tala);
      const live = await activeCall(saad);
      expect(live.call?.id).toBeTruthy();

      await hideDocument(saad);
      await expect(saad.getByTestId("privacy-cover")).toBeVisible();
      await saad.waitForTimeout(16_000);
      await showDocument(saad);
      await expect(saad.getByTestId("lock-screen")).toBeVisible();
      await unlockShhh(saad);
      await expect(saad.getByTestId("lock-screen")).toHaveCount(0, { timeout: 15_000 });

      const after = await waitForMediaDebug(saad, (debug) => debug.connected);
      expect(after.roomName).toBe(before.callerDebug.roomName);
      const still = await activeCall(saad);
      expect(still.call?.id).toBe(live.call?.id);
      expect(still.call?.roomName).toBe(live.call?.roomName);
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });
});
