import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canPauseRecording,
  pickVoiceRecorderMime,
  startVoiceRecording,
  toVoiceFile,
  voiceErrorStatus,
  voiceRecordingExtension,
  voiceRecordingFileName,
  voiceRecordingPassesAllowlist,
} from "@/lib/media/voice-recorder";
import { MIN_VOICE_MESSAGE_MS, normalizeMime } from "@/lib/media/validation";
import { WAVEFORM_MIN_BAR } from "@/lib/media/waveform";

describe("pickVoiceRecorderMime", () => {
  it("prefers mp4 so iPhones can play what anyone records", () => {
    const supported = new Set(["audio/mp4", "audio/webm;codecs=opus"]);
    expect(pickVoiceRecorderMime((mime) => supported.has(mime))).toBe("audio/mp4");
  });

  it("falls through to webm/opus on Chrome", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
    expect(pickVoiceRecorderMime((mime) => supported.has(mime))).toBe("audio/webm;codecs=opus");
  });

  it("falls through to ogg/opus on Firefox", () => {
    const supported = new Set(["audio/ogg;codecs=opus", "audio/ogg"]);
    expect(pickVoiceRecorderMime((mime) => supported.has(mime))).toBe("audio/ogg;codecs=opus");
  });

  it("returns null when the engine records no audio we can accept", () => {
    expect(pickVoiceRecorderMime(() => false)).toBeNull();
  });

  it("survives engines that throw on unknown codec strings", () => {
    expect(
      pickVoiceRecorderMime((mime) => {
        if (mime !== "audio/webm") throw new TypeError("bad codec");
        return true;
      }),
    ).toBe("audio/webm");
  });
});

describe("voice recording files", () => {
  it("maps every recordable container to a playable extension", () => {
    expect(voiceRecordingExtension("audio/mp4;codecs=mp4a.40.2")).toBe("m4a");
    expect(voiceRecordingExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(voiceRecordingExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(voiceRecordingExtension("audio/aac")).toBe("aac");
  });

  it("names the file with the produced type, stripped of codecs", () => {
    const blob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
      type: "audio/webm;codecs=opus",
    });
    const file = toVoiceFile(blob, "audio/webm;codecs=opus", 1_700_000_000_000);
    expect(file.name).toBe("shhh-voice-1700000000000.webm");
    expect(file.type).toBe("audio/webm");
    expect(voiceRecordingFileName("audio/mp4", 12)).toBe("shhh-voice-12.m4a");
  });

  it("passes the server allowlist after codecs are stripped", () => {
    expect(voiceRecordingPassesAllowlist("audio/mp4;codecs=mp4a.40.2")).toBe(true);
    expect(voiceRecordingPassesAllowlist("audio/webm;codecs=opus")).toBe(true);
    expect(voiceRecordingPassesAllowlist("audio/wav")).toBe(false);
    expect(normalizeMime("audio/ogg;codecs=opus")).toBe("audio/ogg");
  });
});

describe("voiceErrorStatus", () => {
  it("separates the four states the UI has copy for", () => {
    expect(voiceErrorStatus({ name: "NotAllowedError" })).toBe("denied");
    expect(voiceErrorStatus({ name: "SecurityError" })).toBe("denied");
    expect(voiceErrorStatus({ name: "NotFoundError" })).toBe("missing");
    expect(voiceErrorStatus({ name: "OverconstrainedError" })).toBe("missing");
    expect(voiceErrorStatus({ name: "NotReadableError" })).toBe("busy");
    expect(voiceErrorStatus({ name: "TrackStartError" })).toBe("busy");
    expect(voiceErrorStatus(new Error("boom"))).toBe("failed");
    expect(voiceErrorStatus(null)).toBe("failed");
  });
});

/* ------------------------------------------------------------------ *
 * Recorder lifecycle, driven by a fake microphone and a fake clock.
 * ------------------------------------------------------------------ */

const SUPPORTED = new Set(["audio/webm;codecs=opus", "audio/webm"]);

let clock = 0;
let frames: FrameRequestCallback[] = [];
let level = 0;

class FakeTrack {
  onended: (() => void) | null = null;
  readyState = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
}

function fakeStream(track: FakeTrack) {
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

class FakeMediaRecorder {
  static isTypeSupported = (mime: string) => SUPPORTED.has(mime);
  state: "inactive" | "recording" | "paused" = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  chunkBytes = 2_048;

  constructor(_stream: MediaStream, options: { mimeType: string }) {
    this.mimeType = options.mimeType;
  }

  start() {
    this.state = "recording";
  }

  pause() {
    this.state = "paused";
  }

  resume() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (this.chunkBytes > 0) {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(this.chunkBytes)]) });
    }
    this.onstop?.();
  }
}

function advance(ms: number, frameCount = 1) {
  for (let i = 0; i < frameCount; i += 1) {
    clock += ms / frameCount;
    const pending = frames;
    frames = [];
    for (const frame of pending) frame(clock);
  }
}

async function start(overrides: Parameters<typeof startVoiceRecording>[0] = {}) {
  const track = new FakeTrack();
  const active = await startVoiceRecording({
    isTypeSupported: (mime) => SUPPORTED.has(mime),
    MediaRecorderImpl: FakeMediaRecorder as unknown as typeof MediaRecorder,
    getStream: async () => fakeStream(track),
    ...overrides,
  });
  return { active, track };
}

describe("startVoiceRecording", () => {
  beforeEach(() => {
    clock = 1_000;
    frames = [];
    level = 0.4;

    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const analyser = {
      fftSize: 1024,
      getFloatTimeDomainData: (target: Float32Array) => target.fill(level),
      connect: () => undefined,
      disconnect: () => undefined,
    };

    class FakeAudioContext {
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      createAnalyser() {
        return analyser;
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }

    const scope = globalThis as unknown as Record<string, unknown>;
    scope.window = {
      AudioContext: FakeAudioContext,
      setInterval: () => 1 as unknown as number,
      clearInterval: () => undefined,
      MediaRecorder: FakeMediaRecorder,
    };
    scope.requestAnimationFrame = (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    };
    scope.cancelAnimationFrame = () => undefined;
    scope.MediaRecorder = FakeMediaRecorder;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    const scope = globalThis as unknown as Record<string, unknown>;
    delete scope.window;
    delete scope.requestAnimationFrame;
    delete scope.cancelAnimationFrame;
    delete scope.MediaRecorder;
  });

  it("records, samples a waveform, and releases the microphone on stop", async () => {
    const { active, track } = await start();
    expect(active.mimeType).toBe("audio/webm;codecs=opus");
    expect(active.canPause).toBe(true);

    advance(3_000, 30);
    expect(active.readings().length).toBeGreaterThan(20);
    expect(active.elapsedMs()).toBeCloseTo(3_000, 0);

    const outcome = await active.stop();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.recording.durationMs).toBeCloseTo(3_000, 0);
    expect(outcome.recording.mimeType).toBe("audio/webm");
    expect(outcome.recording.file.name).toMatch(/\.webm$/u);
    expect(outcome.recording.waveform).toHaveLength(64);
    expect(outcome.recording.waveform.every((v) => v > 0 && v <= 100)).toBe(true);
    expect(track.stop).toHaveBeenCalled();
  });

  it("does not count paused time and stops sampling while paused", async () => {
    const { active } = await start();
    advance(1_000, 10);
    const sampledWhileRecording = active.readings().length;

    active.pause();
    expect(active.isPaused()).toBe(true);
    advance(5_000, 20);
    expect(active.elapsedMs()).toBeCloseTo(1_000, 0);
    expect(active.readings().length).toBe(sampledWhileRecording);

    active.resume();
    expect(active.isPaused()).toBe(false);
    advance(1_000, 10);
    expect(active.elapsedMs()).toBeCloseTo(2_000, 0);
    expect(active.readings().length).toBeGreaterThan(sampledWhileRecording);
  });

  it("reports a tap-tap recording as too short instead of sending it", async () => {
    const { active, track } = await start();
    advance(MIN_VOICE_MESSAGE_MS - 200, 3);
    const outcome = await active.stop();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("too-short");
    expect(track.stop).toHaveBeenCalled();
  });

  it("reports an empty capture when the encoder produced no bytes", async () => {
    class EmptyRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream, options: { mimeType: string }) {
        super(stream, options);
        this.chunkBytes = 0;
      }
    }
    const { active } = await start({
      MediaRecorderImpl: EmptyRecorder as unknown as typeof MediaRecorder,
    });
    advance(4_000, 10);
    const outcome = await active.stop();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("empty");
  });

  it("tells the composer when the encoder dies instead of counting up forever", async () => {
    const built: FakeMediaRecorder[] = [];
    class DyingRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream, options: { mimeType: string }) {
        super(stream, options);
        built.push(this);
      }
    }
    const onInterrupted = vi.fn();
    const { active, track } = await start({
      MediaRecorderImpl: DyingRecorder as unknown as typeof MediaRecorder,
      onInterrupted,
    });
    advance(2_000, 5);
    built[0]?.onerror?.();
    expect(onInterrupted).toHaveBeenCalledTimes(1);

    await active.cancel();
    expect(track.stop).toHaveBeenCalled();
  });

  it("keeps the clock running when the engine refuses to pause", async () => {
    class StubbornRecorder extends FakeMediaRecorder {
      pause() {
        throw new Error("pause unsupported");
      }
    }
    const { active } = await start({
      MediaRecorderImpl: StubbornRecorder as unknown as typeof MediaRecorder,
    });
    advance(1_000, 5);

    active.pause();
    // The audio kept recording, so the duration must keep counting with it.
    expect(active.isPaused()).toBe(false);
    advance(1_000, 5);
    expect(active.elapsedMs()).toBeCloseTo(2_000, 0);
  });

  it("releases the microphone if the recorder refuses to start", async () => {
    class DeadOnArrival extends FakeMediaRecorder {
      start() {
        throw new Error("start failed");
      }
    }
    const track = new FakeTrack();
    await expect(
      startVoiceRecording({
        isTypeSupported: (mime) => SUPPORTED.has(mime),
        MediaRecorderImpl: DeadOnArrival as unknown as typeof MediaRecorder,
        getStream: async () => fakeStream(track),
      }),
    ).rejects.toThrow(/start failed/u);
    expect(track.stop).toHaveBeenCalled();
  });

  it("notifies the cap exactly once and never returns more than the cap", async () => {
    const onCapReached = vi.fn();
    const { active } = await start({ onCapReached });
    advance(11 * 60 * 1_000, 60);
    expect(onCapReached).toHaveBeenCalledTimes(1);
    const outcome = await active.stop();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.recording.durationMs).toBe(10 * 60 * 1_000);
  });

  it("reports an interruption when the microphone is taken away", async () => {
    const onInterrupted = vi.fn();
    const { active, track } = await start({ onInterrupted });
    advance(2_000, 5);
    track.onended?.();
    expect(onInterrupted).toHaveBeenCalledTimes(1);

    // Once torn down, a late ended event must not fire again.
    await active.cancel();
    track.onended?.();
    expect(onInterrupted).toHaveBeenCalledTimes(1);
  });

  it("releases the microphone when the recording is thrown away", async () => {
    const { active, track } = await start();
    advance(2_000, 5);
    await active.cancel();
    expect(track.stop).toHaveBeenCalledTimes(1);
    await active.cancel();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("releases the microphone when the encoder refuses to start", async () => {
    const track = new FakeTrack();
    class BrokenRecorder {
      constructor() {
        throw Object.assign(new Error("no encoder"), { name: "NotSupportedError" });
      }
    }
    await expect(
      startVoiceRecording({
        isTypeSupported: (mime) => SUPPORTED.has(mime),
        MediaRecorderImpl: BrokenRecorder as unknown as typeof MediaRecorder,
        getStream: async () => fakeStream(track),
      }),
    ).rejects.toThrow(/no encoder/u);
    expect(track.stop).toHaveBeenCalled();
  });

  it("never opens the microphone when no audio format is recordable", async () => {
    const getStream = vi.fn();
    await expect(
      startVoiceRecording({ isTypeSupported: () => false, getStream }),
    ).rejects.toMatchObject({ name: "NotSupportedError" });
    expect(getStream).not.toHaveBeenCalled();
  });

  it("keeps a silent recording flat rather than amplifying noise", async () => {
    level = 0;
    const { active } = await start();
    advance(3_000, 30);
    const outcome = await active.stop();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(new Set(outcome.recording.waveform)).toEqual(new Set([WAVEFORM_MIN_BAR]));
  });

  it("hides pause when the engine cannot pause", async () => {
    // Some Safari builds ship MediaRecorder without the pause/resume pair.
    class NoPauseRecorder {
      state: "inactive" | "recording" = "inactive";
      mimeType = "audio/webm;codecs=opus";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(2_048)]) });
        this.onstop?.();
      }
    }
    const { active } = await start({
      MediaRecorderImpl: NoPauseRecorder as unknown as typeof MediaRecorder,
    });
    expect(active.canPause).toBe(false);
    await active.cancel();
  });
});

describe("canPauseRecording", () => {
  it("feature-detects the pause pair on the prototype", () => {
    const scope = globalThis as unknown as Record<string, unknown>;
    scope.MediaRecorder = FakeMediaRecorder;
    expect(canPauseRecording()).toBe(true);
    delete scope.MediaRecorder;
  });
});
