const QUEUE_KEY = "shhh.music.queue";

let resetHandler: (() => void) | null = null;

export function registerMusicPlayerReset(handler: (() => void) | null) {
  resetHandler = handler;
}

export function resetMusicPlayerSession() {
  try {
    sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
  resetHandler?.();
}
