import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { endAnyCall, openTwoUsers, startCall, waitForIncoming } from "./helpers/calls";
import { expectAudioExchange, expectRemoteVideoFrames, waitForConnectedPeers, waitForMediaDebug } from "./helpers/livekit";
import { DESKTOP } from "./helpers/media";

const outDir = path.join(process.cwd(), "visual-qa", "calls-live");

async function settleCall(saad: Page, tala: Page) {
  await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
  await endAnyCall(saad);
  await endAnyCall(tala);
  await saad.waitForTimeout(1_200);
}

test.describe("calls real connected visual QA", () => {
  test("capture real LiveKit-connected states", async ({ browser }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(outDir, { recursive: true });
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await saad.setViewportSize({ width: 390, height: 844 });
      await tala.setViewportSize({ width: 390, height: 844 });

      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await saad.screenshot({ path: path.join(outDir, "light-390-connected-audio.png") });
      await saad.getByTestId("call-mute").click();
      await saad.screenshot({ path: path.join(outDir, "light-390-muted-audio.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await startCall(saad, "video");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await waitForConnectedPeers(saad, tala, "video");
      await expectRemoteVideoFrames(saad);
      await saad.screenshot({ path: path.join(outDir, "light-390-connected-video.png") });
      await saad.getByTestId("call-camera").click();
      await saad.screenshot({ path: path.join(outDir, "light-390-camera-off.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await saad.getByTestId("call-upgrade-video").click();
      await expect(tala.getByTestId("video-call")).toBeVisible({ timeout: 20_000 });
      await waitForMediaDebug(tala, (debug) => debug.remoteVideoSubscribed >= 1);
      await expectRemoteVideoFrames(tala);
      await tala.screenshot({ path: path.join(outDir, "light-390-upgraded-video.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await saad.evaluate(async () => {
        await fetch("/api/theme", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "dark" }),
        });
      });
      await saad.reload();
      await expect(saad.getByTestId("start-audio-call")).toBeVisible();

      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await saad.screenshot({ path: path.join(outDir, "dark-390-connected-audio.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await startCall(saad, "video");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await waitForConnectedPeers(saad, tala, "video");
      await expectRemoteVideoFrames(saad);
      await saad.screenshot({ path: path.join(outDir, "dark-390-connected-video.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await saad.setViewportSize(DESKTOP);
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await saad.screenshot({ path: path.join(outDir, "desktop-connected-audio.png") });
      await saad.getByTestId("end-call").click();
      await settleCall(saad, tala);

      await startCall(saad, "video");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await waitForConnectedPeers(saad, tala, "video");
      await expectRemoteVideoFrames(saad);
      await saad.screenshot({ path: path.join(outDir, "desktop-connected-video.png") });
      await saad.getByTestId("end-call").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });
});
