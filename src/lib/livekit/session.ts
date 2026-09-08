export const CALL_ROOM_RELEASE_MS = 2_500;

type Disconnectable = {
  room: { state: string };
  disconnect: () => Promise<void>;
};

type SessionEntry<T extends Disconnectable> = {
  key: string;
  promise: Promise<T>;
  handles: T | null;
  timer: ReturnType<typeof setTimeout> | null;
};

let entry: SessionEntry<Disconnectable> | null = null;

function isUsable(state: string) {
  return (
    state === "connected" ||
    state === "connecting" ||
    state === "reconnecting" ||
    state === "signalReconnecting"
  );
}

export async function acquireCallRoom<T extends Disconnectable>(
  key: string,
  connect: () => Promise<T>,
): Promise<T> {
  if (entry?.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  if (entry?.key === key) {
    const current = entry.handles;
    if (!current || isUsable(current.room.state)) {
      return entry.promise as Promise<T>;
    }
    await current.disconnect().catch(() => undefined);
    entry = null;
  } else if (entry) {
    const previous = entry;
    entry = null;
    if (previous.timer) clearTimeout(previous.timer);
    const previousHandles = await previous.promise.catch(() => null);
    await previousHandles?.disconnect().catch(() => undefined);
  }

  const promise = connect();
  entry = {
    key,
    promise,
    handles: null,
    timer: null,
  };
  try {
    const handles = await promise;
    if (entry?.promise === promise) {
      entry.handles = handles;
    }
    return handles;
  } catch (error) {
    if (entry?.promise === promise) {
      entry = null;
    }
    throw error;
  }
}

export function releaseCallRoom(key: string) {
  if (!entry || entry.key !== key) return;
  if (entry.timer) clearTimeout(entry.timer);
  const closing = entry;
  closing.timer = setTimeout(() => {
    if (entry !== closing) return;
    entry = null;
    void closing.promise.then((handles) => handles.disconnect()).catch(() => undefined);
  }, CALL_ROOM_RELEASE_MS);
}

export function resetCallRoomSessionForTests() {
  if (entry?.timer) clearTimeout(entry.timer);
  const current = entry;
  entry = null;
  if (current) {
    void current.promise.then((handles) => handles.disconnect()).catch(() => undefined);
  }
  if (mediaOwner?.timer) clearTimeout(mediaOwner.timer);
  mediaOwner?.lock?.release();
  mediaOwner = null;
  pendingHold = null;
}

export type CallMediaLock = { release: () => void };

type MediaOwner = {
  callId: string;
  timer: ReturnType<typeof setTimeout> | null;
  lock: { release: () => void } | null;
};

let mediaOwner: MediaOwner | null = null;
let pendingHold: { callId: string; promise: Promise<CallMediaLock | null> } | null = null;

async function requestBrowserLock(callId: string): Promise<{ release: () => void } | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return { release() {} };

  return new Promise((resolve) => {
    void locks.request(`shhh.call.media.${callId}`, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve(null);
        return;
      }
      await new Promise<void>((hold) => {
        resolve({ release: hold });
      });
    });
  });
}

export async function holdCallMediaLock(callId: string): Promise<CallMediaLock | null> {
  if (mediaOwner?.timer) {
    clearTimeout(mediaOwner.timer);
    mediaOwner.timer = null;
  }
  if (mediaOwner?.callId === callId) {
    return { release() {} };
  }
  if (pendingHold?.callId === callId) {
    return pendingHold.promise;
  }
  if (mediaOwner) {
    const previous = mediaOwner;
    mediaOwner = null;
    if (previous.timer) clearTimeout(previous.timer);
    previous.lock?.release();
  }
  const promise = (async () => {
    const lock = await requestBrowserLock(callId);
    if (!lock) return null;
    mediaOwner = { callId, timer: null, lock };
    return { release() {} };
  })();
  pendingHold = { callId, promise };
  try {
    return await promise;
  } finally {
    if (pendingHold?.promise === promise) pendingHold = null;
  }
}

export function releaseCallMediaLock(callId: string) {
  if (!mediaOwner || mediaOwner.callId !== callId) return;
  if (mediaOwner.timer) clearTimeout(mediaOwner.timer);
  const closing = mediaOwner;
  closing.timer = setTimeout(() => {
    if (mediaOwner !== closing) return;
    mediaOwner.lock?.release();
    mediaOwner = null;
  }, CALL_ROOM_RELEASE_MS);
}
