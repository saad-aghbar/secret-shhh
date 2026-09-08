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

test.describe("calls LiveKit acceptance", () => {
  test.describe.configure({ mode: "default" });

  test("audio Saad → Tala publishes, subscribes, mutes, ends", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      const ringing = await activeCall(saad);
      expect(ringing.call).toBeTruthy();
      const minted = await saad.request.post(`/api/calls/${ringing.call!.id}/token`);
      expect(minted.ok(), "LiveKit token mint must succeed with configured credentials").toBeTruthy();
      const body = (await minted.json()) as { url?: string; token?: string };
      expect(body.url).toMatch(/^wss:\/\//);
      expect(typeof body.token).toBe("string");
      const grants = inspectCallToken(body.token!);
      expect(grants.room).toBe(ringing.call!.roomName);
      expect(grants.identity).toBe(ringing.call!.callerId);
      expect(grants.roomJoin).toBe(true);
      expect(grants.canPublish).toBe(true);
      expect(grants.canSubscribe).toBe(true);
      expect(grants.roomAdmin).toBe(false);
      expect(grants.roomCreate).toBe(false);
      if (grants.ttlSec !== null) {
        expect(grants.ttlSec).toBeGreaterThan(0);
        expect(grants.ttlSec).toBeLessThanOrEqual(15 * 60);
      }

      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expect(saad.getByTestId("audio-call")).toBeVisible({ timeout: 30_000 });
      await expect(tala.getByTestId("audio-call")).toBeVisible({ timeout: 30_000 });

      const peers = await expectAudioExchange(saad, tala);
      expect(peers.callerDebug.identity).toBe(ringing.call!.callerId);
      expect(peers.calleeDebug.identity).toBe(ringing.call!.calleeId);

      await saad.getByTestId("call-mute").click();
      await waitForMediaDebug(saad, (debug) => debug.localAudioMuted || !debug.localAudioPublished);
      await saad.getByTestId("call-mute").click();
      await waitForMediaDebug(saad, (debug) => debug.localAudioPublished && !debug.localAudioMuted);

      const live = await activeCall(saad);
      expect(live.call?.id).toBe(ringing.call!.id);
      expect(live.call?.status).toMatch(/connecting|connected|reconnecting/);

      await saad.getByTestId("end-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await expect(tala.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      expect(await readMediaDebug(saad)).toBeNull();
      await expectCallHistory(saad, "Audio call");
      await expectCallHistory(tala, "Audio call");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("audio Tala → Saad publishes and subscribes", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(tala, "audio");
      await waitForIncoming(saad);
      await saad.getByTestId("accept-call").click();
      await expectAudioExchange(tala, saad);
      await tala.getByTestId("end-call").click();
      await expect(tala.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await expectCallHistory(tala, "Audio call");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("video Saad → Tala has real remote frames, camera off/on, mute", async ({ browser }) => {
    test.setTimeout(240_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "video");
      await waitForIncoming(tala);
      await expect(tala.getByTestId("local-preview")).toHaveCount(0);
      await tala.getByTestId("accept-call").click();
      await expect(saad.getByTestId("video-call")).toBeVisible({ timeout: 30_000 });
      await expect(tala.getByTestId("video-call")).toBeVisible({ timeout: 30_000 });

      const peers = await waitForConnectedPeers(saad, tala, "video");
      expect(peers.callerDebug.localVideoPublications).toBe(1);
      expect(peers.calleeDebug.localVideoPublications).toBe(1);
      expect(peers.callerDebug.localVideoPublished).toBe(true);
      expect(peers.calleeDebug.localVideoPublished).toBe(true);
      expect(peers.callerDebug.remoteVideoSubscribed).toBeGreaterThanOrEqual(1);
      expect(peers.calleeDebug.remoteVideoSubscribed).toBeGreaterThanOrEqual(1);
      expect(peers.callerDebug.localAudioPublished).toBe(true);

      const saadFrames = await expectRemoteVideoFrames(saad);
      const talaFrames = await expectRemoteVideoFrames(tala);
      expect(saadFrames.timeAdvanced).toBe(true);
      expect(talaFrames.timeAdvanced).toBe(true);
      await expect(saad.getByTestId("local-preview")).toBeVisible();

      await saad.getByTestId("call-mute").click();
      await waitForMediaDebug(saad, (debug) => debug.localAudioMuted || !debug.localAudioPublished);
      await saad.getByTestId("call-mute").click();
      await waitForMediaDebug(saad, (debug) => debug.localAudioPublished);

      await saad.getByTestId("call-camera").click();
      await waitForMediaDebug(saad, (debug) => !debug.localVideoPublished);
      expect((await readMediaDebug(saad))?.localVideoPublications).toBeLessThanOrEqual(1);
      await waitForMediaDebug(tala, (debug) => debug.remoteVideoSubscribed === 0);
      await saad.getByTestId("call-camera").click();
      await waitForMediaDebug(saad, (debug) => debug.localVideoPublished);
      expect((await readMediaDebug(saad))?.localVideoPublications).toBe(1);
      await expectRemoteVideoFrames(tala);

      await saad.getByTestId("end-call").click();
      await expect(saad.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
      await expectCallHistory(saad, "Video call");
      await expectCallHistory(tala, "Video call");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("video Tala → Saad has real remote frames", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(tala, "video");
      await waitForIncoming(saad);
      await saad.getByTestId("accept-call").click();
      await waitForConnectedPeers(tala, saad, "video");
      await expectRemoteVideoFrames(tala);
      await expectRemoteVideoFrames(saad);
      await tala.getByTestId("end-call").click();
      await expect(tala.getByTestId("call-surface")).toBeHidden({ timeout: 15_000 });
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("audio upgrades to video in the same room, partner camera stays off", async ({ browser }) => {
    test.setTimeout(240_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      const before = await expectAudioExchange(saad, tala);
      const first = await activeCall(saad);
      expect(first.call?.type).toBe("audio");

      await saad.getByTestId("call-upgrade-video").click();
      await expect(saad.getByTestId("video-call")).toBeVisible({ timeout: 20_000 });
      await expect(tala.getByTestId("video-call")).toBeVisible({ timeout: 20_000 });
      await expect(tala.getByTestId("video-upgrade-note")).toBeVisible({ timeout: 10_000 });

      const saadAfter = await waitForMediaDebug(
        saad,
        (debug) => debug.connected && debug.localVideoPublished && debug.localAudioPublications === 1,
      );
      const talaAfter = await waitForMediaDebug(
        tala,
        (debug) =>
          debug.connected &&
          debug.remoteVideoSubscribed >= 1 &&
          debug.localVideoPublications === 0,
      );
      expect(saadAfter.roomName).toBe(before.callerDebug.roomName);
      expect(talaAfter.roomName).toBe(before.callerDebug.roomName);
      expect(saadAfter.localVideoPublications).toBe(1);
      expect(talaAfter.localVideoPublications).toBe(0);
      await expectRemoteVideoFrames(tala);

      const live = await activeCall(saad);
      expect(live.call?.id).toBe(first.call?.id);
      expect(live.call?.roomName).toBe(first.call?.roomName);
      expect(live.call?.type).toBe("video");
      expect(live.call?.videoUpgradedBy).toBe(first.call?.callerId);

      await tala.getByTestId("call-camera").click();
      await waitForMediaDebug(tala, (debug) => debug.localVideoPublications === 1);
      await expectRemoteVideoFrames(saad);
      expect((await readMediaDebug(tala))?.localVideoPublications).toBe(1);

      await saad.getByTestId("end-call").click();
      await expectCallHistory(saad, "Video call");
      await expectCallHistory(tala, "Video call");
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });

  test("speaker toggle is capability-honest", async ({ browser }) => {
    test.setTimeout(180_000);
    const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
    try {
      await startCall(saad, "audio");
      await waitForIncoming(tala);
      await tala.getByTestId("accept-call").click();
      await expectAudioExchange(saad, tala);
      const debug = await waitForMediaDebug(saad, (value) => value.connected);
      if (!debug.speakerSupported) {
        await expect(saad.getByTestId("call-speaker")).toHaveCount(0);
        return;
      }
      const before = debug.audioOutputDeviceId ?? null;
      await saad.getByTestId("call-speaker").click();
      await expect(saad.getByTestId("call-speaker")).toHaveAttribute("aria-pressed", "true");
      await waitForMediaDebug(saad, (value) => value.speakerMode === "speaker");
      const after = await readMediaDebug(saad);
      if (after?.audioOutputDeviceId) {
        expect(after.audioOutputDeviceId).not.toBe(before);
      }
      await saad.getByTestId("end-call").click();
    } finally {
      await saadContext.close();
      await talaContext.close();
    }
  });
});
