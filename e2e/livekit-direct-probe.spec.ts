import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

import { openTwoUsers } from "./helpers/calls";

const umd = path.join(process.cwd(), "node_modules/livekit-client/dist/livekit-client.umd.js");

async function leaveApp(page: Page) {
  const probe = await page.evaluate(() => {
    const blob = new Blob(["<!doctype html><title>livekit-probe</title>"], { type: "text/html" });
    return URL.createObjectURL(blob);
  });
  await page.goto(probe);
}

async function connectDirect(page: Page, url: string, token: string) {
  await page.addScriptTag({ path: umd });
  return page.evaluate(async ({ url, token }) => {
    const client = (window as unknown as { LivekitClient: { Room: new () => {
      connect: (url: string, token: string) => Promise<void>;
      state: string;
      name: string;
      localParticipant: {
        identity: string;
        setMicrophoneEnabled: (enabled: boolean) => Promise<unknown>;
        audioTrackPublications: { size: number };
      };
      remoteParticipants: { size: number; values: () => Iterable<{ identity: string }> };
    } } }).LivekitClient;
    const room = new client.Room();
    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    return {
      state: room.state,
      roomName: room.name,
      identity: room.localParticipant.identity,
      localAudio: room.localParticipant.audioTrackPublications.size,
      remoteCount: room.remoteParticipants.size,
      remoteIdentities: [...room.remoteParticipants.values()].map((participant) => participant.identity),
    };
  }, { url, token });
}

test("direct LiveKit Cloud publish/subscribe without React", async ({ browser }) => {
  test.setTimeout(120_000);
  const { saad, tala, saadContext, talaContext } = await openTwoUsers(browser);
  try {
    await leaveApp(saad);
    await leaveApp(tala);
    await saad.waitForTimeout(1_500);

    const started = await saad.request.post("/api/calls", { data: { type: "audio" } });
    expect(started.ok()).toBeTruthy();
    const call = (await started.json()) as { id: string; roomName: string; callerId: string; calleeId: string };
    const accepted = await tala.request.post(`/api/calls/${call.id}/accept`);
    expect(accepted.ok()).toBeTruthy();

    const saadMint = await saad.request.post(`/api/calls/${call.id}/token`);
    const talaMint = await tala.request.post(`/api/calls/${call.id}/token`);
    expect(saadMint.ok()).toBeTruthy();
    expect(talaMint.ok()).toBeTruthy();
    const saadBody = (await saadMint.json()) as { url: string; token: string };
    const talaBody = (await talaMint.json()) as { url: string; token: string };
    expect(saadBody.url).toMatch(/^wss:\/\//);

    const [saadRoom, talaRoom] = await Promise.all([
      connectDirect(saad, saadBody.url, saadBody.token),
      connectDirect(tala, talaBody.url, talaBody.token),
    ]);

    expect(saadRoom.state).toBe("connected");
    expect(talaRoom.state).toBe("connected");
    expect(saadRoom.roomName).toBe(call.roomName);
    expect(talaRoom.roomName).toBe(call.roomName);
    expect(saadRoom.identity).toBe(call.callerId);
    expect(talaRoom.identity).toBe(call.calleeId);
    expect(saadRoom.localAudio).toBe(1);
    expect(talaRoom.localAudio).toBe(1);
    expect(saadRoom.remoteCount).toBeGreaterThanOrEqual(1);
    expect(talaRoom.remoteCount).toBeGreaterThanOrEqual(1);
    expect(saadRoom.remoteIdentities).toContain(call.calleeId);
    expect(talaRoom.remoteIdentities).toContain(call.callerId);

    await saad.request.post(`/api/calls/${call.id}/end`).catch(() => undefined);
  } finally {
    await saadContext.close();
    await talaContext.close();
  }
});
