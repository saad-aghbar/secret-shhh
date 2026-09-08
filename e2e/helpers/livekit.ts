import { expect, type Page } from "@playwright/test";

type CallMediaDebug = {
  connected: boolean;
  connectionState: string;
  roomName: string;
  identity: string;
  localAudioPublished: boolean;
  localAudioMuted: boolean;
  localAudioPublications: number;
  localVideoPublished: boolean;
  localVideoMuted: boolean;
  localVideoPublications: number;
  remoteCount: number;
  remoteIdentities: string[];
  remoteAudioSubscribed: number;
  remoteVideoSubscribed: number;
  remoteAudioPublications: number;
  remoteVideoPublications: number;
  captureWidth: number | null;
  captureHeight: number | null;
  captureFrameRate: number | null;
  audioOutputDeviceId?: string | null;
  speakerMode?: "system" | "speaker";
  speakerSupported?: boolean;
};

export async function readMediaDebug(page: Page): Promise<CallMediaDebug | null> {
  return page.evaluate(() => window.__shhhCallMediaDebug ?? null);
}

export async function waitForMediaDebug(
  page: Page,
  check: (debug: CallMediaDebug) => boolean,
  timeout = 45_000,
) {
  let latest: CallMediaDebug | null = null;
  try {
    await expect
      .poll(async () => {
        latest = await readMediaDebug(page);
        return Boolean(latest && check(latest));
      }, { timeout })
      .toBe(true);
  } catch (error) {
    const status = await page
      .locator("[data-call-status]")
      .first()
      .getAttribute("data-call-status")
      .catch(() => null);
    throw new Error(
      `LiveKit media not ready: ${JSON.stringify({ latest, status })}`,
      { cause: error },
    );
  }
  expect(latest).toBeTruthy();
  return latest!;
}

export async function waitForConnectedPeers(
  caller: Page,
  callee: Page,
  kind: "audio" | "video" = "audio",
) {
  const ready = (debug: CallMediaDebug) =>
    debug.connected &&
    debug.remoteCount >= 1 &&
    debug.localAudioPublished &&
    debug.remoteAudioSubscribed >= 1 &&
    (kind === "audio" || (debug.localVideoPublished && debug.remoteVideoSubscribed >= 1));
  const [callerDebug, calleeDebug] = await Promise.all([
    waitForMediaDebug(caller, ready),
    waitForMediaDebug(callee, ready),
  ]);
  expect(callerDebug.roomName).toBe(calleeDebug.roomName);
  expect(callerDebug.roomName.startsWith("shhh-call-")).toBe(true);
  expect(callerDebug.identity).not.toBe(calleeDebug.identity);
  expect(callerDebug.remoteCount).toBeGreaterThanOrEqual(1);
  expect(calleeDebug.remoteCount).toBeGreaterThanOrEqual(1);
  if (callerDebug.remoteIdentities.length > 0) {
    expect(callerDebug.remoteIdentities).toContain(calleeDebug.identity);
  }
  if (calleeDebug.remoteIdentities.length > 0) {
    expect(calleeDebug.remoteIdentities).toContain(callerDebug.identity);
  }
  return { callerDebug, calleeDebug };
}

export async function expectAudioExchange(caller: Page, callee: Page) {
  const peers = await waitForConnectedPeers(caller, callee);
  expect(peers.callerDebug.localAudioPublications).toBe(1);
  expect(peers.calleeDebug.localAudioPublications).toBe(1);
  expect(peers.callerDebug.localAudioPublished).toBe(true);
  expect(peers.calleeDebug.localAudioPublished).toBe(true);
  expect(peers.callerDebug.remoteAudioSubscribed).toBeGreaterThanOrEqual(1);
  expect(peers.calleeDebug.remoteAudioSubscribed).toBeGreaterThanOrEqual(1);
  return peers;
}

export async function expectRemoteVideoFrames(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const video = document.querySelector<HTMLVideoElement>("[data-testid='remote-video']");
          if (!video) return null;
          return {
            readyState: video.readyState,
            width: video.videoWidth,
            height: video.videoHeight,
            time: video.currentTime,
          };
        }),
      { timeout: 45_000 },
    )
    .toEqual(
      expect.objectContaining({
        readyState: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        time: expect.any(Number),
      }),
    );
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const video = document.querySelector<HTMLVideoElement>("[data-testid='remote-video']");
          return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
        }),
      { timeout: 45_000 },
    )
    .toBe(true);
  const first = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("[data-testid='remote-video']")!;
    return {
      readyState: video.readyState,
      width: video.videoWidth,
      height: video.videoHeight,
      time: video.currentTime,
    };
  });
  expect(first.readyState).toBeGreaterThanOrEqual(2);
  expect(first.width).toBeGreaterThan(0);
  expect(first.height).toBeGreaterThan(0);
  const startTime = first.time;
  await expect
    .poll(
      async () =>
        page.evaluate((baseline) => {
          const video = document.querySelector<HTMLVideoElement>("[data-testid='remote-video']");
          return Boolean(video && video.readyState >= 2 && video.currentTime > baseline);
        }, startTime),
      { timeout: 10_000 },
    )
    .toBe(true);
  const second = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("[data-testid='remote-video']")!;
    return video.currentTime;
  });
  expect(second).toBeGreaterThan(startTime);
  return { ...first, timeAdvanced: second > startTime };
}

export function inspectCallToken(jwt: string) {
  const part = jwt.split(".")[1] ?? "";
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
  const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
    sub?: string;
    name?: string;
    iat?: number;
    exp?: number;
    video?: {
      room?: string;
      roomJoin?: boolean;
      canPublish?: boolean;
      canSubscribe?: boolean;
      roomAdmin?: boolean;
      roomCreate?: boolean;
      roomList?: boolean;
    };
  };
  const video = payload.video ?? {};
  return {
    identity: payload.sub ?? "",
    name: payload.name ?? "",
    room: video.room ?? "",
    roomJoin: Boolean(video.roomJoin),
    canPublish: Boolean(video.canPublish),
    canSubscribe: Boolean(video.canSubscribe),
    roomAdmin: Boolean(video.roomAdmin),
    roomCreate: Boolean(video.roomCreate),
    roomList: Boolean(video.roomList),
    ttlSec:
      typeof payload.exp === "number" && typeof payload.iat === "number"
        ? payload.exp - payload.iat
        : null,
  };
}

export async function activeCall(page: Page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/calls", { credentials: "same-origin" });
    return {
      ok: response.ok,
      status: response.status,
      body: (await response.json().catch(() => null)) as {
        call: {
          id: string;
          roomName: string;
          callerId: string;
          calleeId: string;
          status: string;
          type: string;
          videoUpgradedBy?: string | null;
        } | null;
      } | null,
    };
  });
  expect(result.ok, `GET /api/calls ${result.status}`).toBeTruthy();
  expect(result.body).toBeTruthy();
  return result.body as {
    call: {
      id: string;
      roomName: string;
      callerId: string;
      calleeId: string;
      status: string;
      type: string;
      videoUpgradedBy?: string | null;
    } | null;
  };
}
