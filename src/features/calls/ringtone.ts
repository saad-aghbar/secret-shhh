let context: AudioContext | null = null;
let playing: { stop: () => void } | null = null;
let ringLock: { release?: () => void } | null = null;

function ensureContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

function tonePattern(kind: "ring" | "ringback") {
  // Soft two-note pulse — not an Apple or Instagram copy.
  if (kind === "ringback") {
    return { a: 392, b: 494, on: 420, off: 280, gap: 1_600 };
  }
  return { a: 440, b: 554, on: 380, off: 220, gap: 1_200 };
}

function startOscillators(kind: "ring" | "ringback") {
  const ctx = ensureContext();
  if (!ctx || playing) return;
  const pattern = tonePattern(kind);
  let cancelled = false;
  let timeout = 0;
  const master = ctx.createGain();
  master.gain.value = 0.07;
  master.connect(ctx.destination);

  function pulse() {
    if (cancelled || !ctx) return;
    const now = ctx.currentTime;
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const env = ctx.createGain();
    oscA.type = "sine";
    oscB.type = "sine";
    oscA.frequency.value = pattern.a;
    oscB.frequency.value = pattern.b;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.04);
    env.gain.setValueAtTime(1, now + pattern.on / 1000 - 0.05);
    env.gain.linearRampToValueAtTime(0, now + pattern.on / 1000);
    oscA.connect(env);
    oscB.connect(env);
    env.connect(master);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + pattern.on / 1000 + 0.02);
    oscB.stop(now + pattern.on / 1000 + 0.02);
    timeout = window.setTimeout(() => {
      if (cancelled) return;
      timeout = window.setTimeout(pulse, pattern.gap);
    }, pattern.on + pattern.off);
  }

  void ctx.resume().catch(() => undefined);
  pulse();
  playing = {
    stop() {
      cancelled = true;
      window.clearTimeout(timeout);
      master.disconnect();
    },
  };
}

export function stopRingtone() {
  playing?.stop();
  playing = null;
  ringLock?.release?.();
  ringLock = null;
}

export async function startRingtone(kind: "ring" | "ringback") {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  if (playing) return;

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    try {
      await new Promise<void>((resolve) => {
        void locks.request("shhh.call.ringtone", { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve();
            return;
          }
          startOscillators(kind);
          await new Promise<void>((hold) => {
            ringLock = { release: hold };
          });
          resolve();
        });
      });
      return;
    } catch {
      /* fall through */
    }
  }
  startOscillators(kind);
}
