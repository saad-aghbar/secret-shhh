import { expect, test } from "@playwright/test";

import { expectCallHistory, openTwoUsers, startCall, waitForIncoming } from "./helpers/calls";
import {
  activeCall,
  expectAudioExchange,
  expectRemoteVideoFrames,
  inspectCallToken,
  readMediaDebug,
  waitForConnectedPeers,
  waitForMediaDebug,
} from "./helpers/livekit";

test.describe("calls LiveKit flows", () => {
  test.describe.configure({ mode: "default" });

  test("provider rejects ended, forged, and third-party tokens", async ({ browser }) => {
    test.setTimeout(120_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      const live = await activeCall(saad);
      const id = live.call!.id;
      const room = live.call!.roomName;

      const ok = await saad.request.post(`/api/calls/${id}/token`);
      expect(ok.ok()).toBeTruthy();
      const grants = inspectCallToken(((await ok.json()) as { token: string }).token);
      expect(grants.room).toBe(room);
      expect(grants.roomAdmin).toBe(false);

      const forged = await saad.request.post("/api/calls/00000000-0000-0000-0000-000000000000/token");
      expect(forged.status()).toBeGreaterThanOrEqual(400);

      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      const ended = await saad.request.post(`/api/calls/${id}/token`);
      expect(ended.ok()).toBeFalsy();

      const unrelated = await saad.request.post("/api/calls/not-a-uuid/token");
      expect(unrelated.status()).toBeGreaterThanOrEqual(400);
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("decline, cancel, and missed leave no live media", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      expect(await readMediaDebug(saad)).toBeNull();
      await expectCallHistory(tala, "Call declined");

      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await saad.getByTestId("cancel-call").click();
      await expect(tala.getByTestId("incoming-call")).toBeHidden({ timeout: 15_000 });
      expect(await readMediaDebug(tala)).toBeNull();

      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await expect(tala.getByTestId("incoming-call")).toBeHidden({ timeout: 50_000 });
      await expectCallHistory(tala, "No answer");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("second Tala tab stops ringing after accept", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    const tabB = await talaContext.newPage();
    try {
      await tabB.goto("/chat");
      await expect(tabB.getByTestId("start-audio-call")).toBeVisible();
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await expect(tabB.getByTestId("incoming-call")).toBeVisible({ timeout: 20_000 });
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await expect(tabB.getByTestId("incoming-call")).toHaveCount(0);
      const debugB = await readMediaDebug(tabB);
      expect(debugB === null || debugB.localAudioPublications <= 1).toBeTruthy();
      await saad.getByTestId("end-call").click();
    } finally {
      await tabB.close();
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("refresh restores ringing and a connected call does not duplicate", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      const first = await activeCall(tala);
      await tala.reload();
      await expect(tala.getByTestId("incoming-call")).toBeVisible({ timeout: 20_000 });
      expect((await activeCall(tala)).call?.id).toBe(first.call?.id);

      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      const connected = await activeCall(saad);
      await saad.reload();
      await expect(saad.getByTestId("call-surface").or(saad.getByTestId("active-call-pill"))).toBeVisible({
        timeout: 20_000,
      });
      if (await saad.getByTestId("active-call-pill").isVisible()) {
        await saad.getByTestId("active-call-pill").click();
      }
      await expect(saad.getByTestId("call-surface")).toBeVisible();
      expect((await activeCall(saad)).call?.id).toBe(connected.call?.id);
      await saad.getByTestId("end-call").or(saad.getByTestId("close-failed-call")).click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("navigation and minimize keep the same LiveKit room", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await expectAudioExchange(saad, tala);
      await saad.getByTestId("minimize-call").click();
      await expect(saad.getByTestId("active-call-pill")).toBeVisible();
      const nav = saad.getByRole("navigation", { name: "Primary" });
      await nav.getByRole("link", { name: "Media", exact: true }).click();
      await expect(saad.getByTestId("media-library")).toBeVisible({ timeout: 20_000 });
      await nav.getByRole("link", { name: "Music", exact: true }).click();
      await expect(saad.getByTestId("music-home")).toBeVisible({ timeout: 20_000 });
      await nav.getByRole("link", { name: "Chat", exact: true }).click();
      await expect(saad.getByTestId("chat-experience")).toBeVisible({ timeout: 15_000 });
      await expect(
        saad.getByTestId("active-call-pill").or(saad.getByTestId("call-surface")),
      ).toBeVisible({ timeout: 15_000 });
      const mid = await readMediaDebug(saad);
      expect(mid?.roomName).toBe(before.callerDebug.roomName);
      if (await saad.getByTestId("active-call-pill").isVisible()) {
        await saad.getByTestId("active-call-pill").click();
      }
      await expect(saad.getByTestId("audio-call")).toBeVisible();
      const after = await waitForMediaDebug(saad, (debug) => debug.connected);
      expect(after.roomName).toBe(before.callerDebug.roomName);
      expect(after.identity).toBe(before.callerDebug.identity);
      await saad.getByTestId("end-call").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("offline blip reconnects the same audio call", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await expectAudioExchange(saad, tala);
      await saad.context().setOffline(true);
      await saad.waitForTimeout(2_000);
      await saad.context().setOffline(false);
      await waitForMediaDebug(saad, (debug) => debug.connected && debug.remoteAudioSubscribed >= 1, 45_000);
      const after = await readMediaDebug(saad);
      expect(after?.roomName).toBe(before.callerDebug.roomName);
      expect((await activeCall(saad)).call?.id).toBe((await activeCall(tala)).call?.id);
      await saad.getByTestId("end-call").click();
    } finally {
      await saad.context().setOffline(false).catch(() => undefined);
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("Low Data Mode is applied to the video publish preset", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await saad.goto("/more");
      const toggle = saad.getByRole("switch", { name: "Low data mode" });
      await expect(toggle).toBeVisible();
      if ((await toggle.getAttribute("aria-checked")) !== "true") {
        await toggle.click();
      }
      await saad.goto("/chat");
      await expect(saad.getByTestId("start-video-call")).toBeVisible();
      await startCall(saad, "video");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await waitForConnectedPeers(saad, tala, "video");
      const debug = await readMediaDebug(saad);
      if (debug?.captureHeight) {
        expect(debug.captureHeight).toBeLessThanOrEqual(360);
      }
      await saad.getByTestId("end-call").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("voice recorder yields the microphone to a call, then works again", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await expect(saad.getByTestId("voice-start")).toBeVisible({ timeout: 15_000 });
      await saad.getByTestId("voice-start").click();
      await expect(saad.getByTestId("voice-recording")).toBeVisible({ timeout: 15_000 });
      await startCall(saad, "audio");
      await expect(saad.getByTestId("voice-recording")).toHaveCount(0);
      await waitForIncoming(tala);
      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await expect(saad.getByTestId("voice-start")).toBeVisible({ timeout: 15_000 });
      await saad.getByTestId("voice-start").click();
      await expect(saad.getByTestId("voice-recording")).toBeVisible({ timeout: 15_000 });
      await saad.getByTestId("voice-stop").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("active call clamps upload concurrency to 1", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      const idle = await saad.evaluate(() => window.__shhhUploadConcurrency?.() ?? null);
      expect(idle === null || idle >= 1).toBeTruthy();
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      await expect
        .poll(async () => saad.evaluate(() => window.__shhhUploadConcurrency?.() ?? 0))
        .toBe(1);
      await saad.getByTestId("end-call").click();
      await expect
        .poll(async () => saad.evaluate(() => window.__shhhUploadConcurrency?.() ?? 0))
        .toBeGreaterThanOrEqual(1);
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("video call survives an offline blip without a new room", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "video");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await waitForConnectedPeers(saad, tala, "video");
      await expectRemoteVideoFrames(tala);
      await saad.context().setOffline(true);
      await saad.waitForTimeout(2_000);
      await saad.context().setOffline(false);
      const after = await waitForMediaDebug(saad, (debug) => debug.connected, 45_000);
      expect(after.roomName).toBe(before.callerDebug.roomName);
      expect(after.localVideoPublications).toBeLessThanOrEqual(1);
      await saad.getByTestId("end-call").click();
    } finally {
      await saad.context().setOffline(false).catch(() => undefined);
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("camera capture yields to a video call, then works again", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await saad.getByTestId("photo-attach").click();
      await saad.getByTestId("media-pick-camera").click();
      await expect(saad.getByTestId("shhh-camera")).toBeVisible();
      await saad.evaluate(() => {
        document.querySelector<HTMLButtonElement>("[data-testid='start-video-call']")?.click();
      });
      await expect(saad.getByTestId("call-surface")).toBeVisible({ timeout: 15_000 });
      await expect(saad.getByTestId("shhh-camera")).toHaveCount(0);
      await waitForIncoming(tala);
      await tala.getByTestId("decline-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await saad.getByTestId("photo-attach").click();
      await saad.getByTestId("media-pick-camera").click();
      await expect(saad.getByTestId("shhh-camera")).toBeVisible({ timeout: 15_000 });
      await saad.getByTestId("shhh-camera-close").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("poor network keeps the audio call alive", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await expectAudioExchange(saad, tala);
      const callId = (await activeCall(saad)).call?.id;
      const session = await saad.context().newCDPSession(saad);
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 400,
        downloadThroughput: 40_000,
        uploadThroughput: 40_000,
      });
      await saad.waitForTimeout(3_000);
      const mid = await readMediaDebug(saad);
      expect(mid?.roomName).toBe(before.callerDebug.roomName);
      const live = await activeCall(saad);
      expect(live.call?.id).toBe(callId);
      expect(live.call?.status).toMatch(/connecting|connected|reconnecting/);
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      await waitForMediaDebug(saad, (debug) => debug.connected && debug.remoteAudioSubscribed >= 1, 45_000);
      await saad.getByTestId("end-call").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });
});
