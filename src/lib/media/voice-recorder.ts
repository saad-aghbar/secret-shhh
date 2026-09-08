import { captureErrorStatus } from "@/lib/media/capture-errors";
import { deviceOwner } from "@/lib/media/device-owner";
import {
  isAllowedAudioMime,
  MAX_VOICE_MESSAGE_MS,
  MIN_VOICE_MESSAGE_MS,
  normalizeMime,
} from "@/lib/media/validation";
import { compressWaveform, frameAmplitude } from "@/lib/media/waveform";

/**
 * MP4/AAC first: only Safari can record it, but every browser and every iPhone can
 * play it back. Chrome and Edge fall through to WebM/Opus, Firefox to Ogg/Opus.
 */
export const VOICE_RECORDER_MIME_CANDIDATES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

/** Speech processing on, single channel — a voice note, not a field recording. */
const VOICE_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/** ~20 readings a second keeps a 10 minute envelope small and the bars calm. */
const SAMPLE_INTERVAL_MS = 50;
const CAP_WATCHDOG_MS = 400;

export type VoiceRecorderErrorStatus = "denied" | "missing" | "busy" | "unsupported" | "failed";

export type VoiceRecordingResult = {
  file: File;
  mimeType: string;
  durationMs: number;
  /** Compressed 0–100 buckets, ready to persist with the message. */
  waveform: number[];
  /** Raw envelope, kept in memory for the pre-send preview. */
  readings: number[];
};

export type VoiceRecordingOutcome =
  { ok: true; recording: VoiceRecordingResult } | { ok: false; reason: "too-short" | "empty" };

export type ActiveVoiceRecording = {
  mimeType: string;
  canPause: boolean;
  isPaused: () => boolean;
  elapsedMs: () => number;
  /** Raw readings so far — the live waveform reads this from its own frame loop. */
  readings: () => number[];
  pause: () => void;
  resume: () => void;
  stop: () => Promise<VoiceRecordingOutcome>;
  /** Throw the recording away and release the microphone. */
  cancel: () => Promise<void>;
};

type StartVoiceRecordingOptions = {
  isTypeSupported?: (mime: string) => boolean;
  MediaRecorderImpl?: typeof MediaRecorder;
  getStream?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Fired once when the duration cap is hit; the caller decides to stop. */
  onCapReached?: () => void;
  /** The microphone went away — another app took it, or the device was unplugged. */
  onInterrupted?: () => void;
};

export function pickVoiceRecorderMime(
  isTypeSupported: (mime: string) => boolean = defaultIsTypeSupported,
): string | null {
  for (const candidate of VOICE_RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      /* some engines throw on unknown codecs */
    }
  }
  return null;
}

function defaultIsTypeSupported(mime: string) {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);
}

export function voiceRecordingExtension(mimeType: string): "m4a" | "webm" | "ogg" | "aac" {
  const normalized = normalizeMime(mimeType);
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/aac") return "aac";
  return "webm";
}

export function voiceRecordingFileName(mimeType: string, at = Date.now()): string {
  return `shhh-voice-${at}.${voiceRecordingExtension(mimeType)}`;
}

export function toVoiceFile(blob: Blob, mimeType: string, at = Date.now()): File {
  const type = normalizeMime(mimeType) || normalizeMime(blob.type) || "audio/webm";
  return new File([blob], voiceRecordingFileName(type, at), { type, lastModified: at });
}

export function voiceRecordingPassesAllowlist(mimeType: string): boolean {
  return isAllowedAudioMime(normalizeMime(mimeType));
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    pickVoiceRecorderMime() !== null
  );
}

export function canPauseRecording(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.prototype?.pause === "function" &&
    typeof MediaRecorder.prototype?.resume === "function"
  );
}

export function voiceErrorStatus(error: unknown): VoiceRecorderErrorStatus {
  return captureErrorStatus(error);
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

type Meter = {
  read: () => number;
  close: () => Promise<void>;
};

/**
 * Analyser tap for the live waveform. Deliberately never connected to the
 * destination — routing the microphone to the speakers would feed back.
 */
function createMeter(stream: MediaStream): Meter | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  let context: AudioContext;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  try {
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    // iOS hands back a suspended context until a gesture resumes it.
    void context.resume?.().catch(() => undefined);

    const floats = new Float32Array(analyser.fftSize);
    const bytes = new Uint8Array(analyser.fftSize);
    const hasFloat = typeof analyser.getFloatTimeDomainData === "function";

    return {
      read: () => {
        if (hasFloat) {
          analyser.getFloatTimeDomainData(floats);
          return frameAmplitude(floats);
        }
        analyser.getByteTimeDomainData(bytes);
        let sum = 0;
        for (let i = 0; i < bytes.length; i += 1) {
          const value = ((bytes[i] ?? 128) - 128) / 128;
          sum += value * value;
        }
        return Math.sqrt(sum / bytes.length);
      },
      close: async () => {
        try {
          source.disconnect();
          analyser.disconnect();
        } catch {
          /* already torn down */
        }
        await context.close?.().catch(() => undefined);
      },
    };
  } catch {
    void context.close?.().catch(() => undefined);
    return null;
  }
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Open the microphone and start recording.
 *
 * Throws on permission or device failure — classify it with `voiceErrorStatus`.
 * Every exit path (stop, cancel, throw) releases the microphone and the audio context.
 */
export async function startVoiceRecording(
  options: StartVoiceRecordingOptions = {},
): Promise<ActiveVoiceRecording> {
  const preferred = pickVoiceRecorderMime(options.isTypeSupported);
  if (!preferred) {
    throw Object.assign(new Error("No supported audio recorder"), { name: "NotSupportedError" });
  }

  const claim = deviceOwner.claim("voice-recorder");
  if (!claim.ok) {
    throw Object.assign(new Error(claim.message), { name: "NotReadableError" });
  }

  const getStream =
    options.getStream ??
    ((constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints));
  let stream: MediaStream;
  try {
    stream = await getStream({ audio: VOICE_TRACK_CONSTRAINTS });
  } catch (error) {
    deviceOwner.release("voice-recorder");
    throw error;
  }

  const Recorder = options.MediaRecorderImpl ?? MediaRecorder;
  let recorder: MediaRecorder;
  try {
    recorder = new Recorder(stream, { mimeType: preferred });
  } catch (error) {
    stopStream(stream);
    deviceOwner.release("voice-recorder");
    throw error;
  }

  const meter = createMeter(stream);
  const chunks: Blob[] = [];
  const readings: number[] = [];

  let paused = false;
  let closed = false;
  let capNotified = false;
  let segmentStart = performance.now();
  let accumulatedMs = 0;
  let lastSampleAt = 0;
  let frame: number | null = null;
  let watchdog: number | null = null;

  const elapsedMs = () =>
    paused ? accumulatedMs : accumulatedMs + (performance.now() - segmentStart);

  const notifyCap = () => {
    if (capNotified || closed) return;
    if (elapsedMs() < MAX_VOICE_MESSAGE_MS) return;
    capNotified = true;
    options.onCapReached?.();
  };

  const sample = () => {
    frame = null;
    if (closed) return;
    if (!paused && meter) {
      const now = performance.now();
      if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
        lastSampleAt = now;
        readings.push(meter.read());
      }
    }
    notifyCap();
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);

  // Frame callbacks stop in a hidden tab; a timer still fires (throttled) so the
  // cap cannot be blown past by leaving Shhh in the background.
  watchdog = window.setInterval(notifyCap, CAP_WATCHDOG_MS);

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  const [track] = stream.getAudioTracks();
  if (track) {
    track.onended = () => {
      if (!closed) options.onInterrupted?.();
    };
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    // A dead encoder must not leave the bar counting up forever.
    recorder.onerror = () => {
      resolve();
      if (!closed) options.onInterrupted?.();
    };
  });

  const teardown = async () => {
    if (closed) return;
    closed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    if (watchdog !== null) window.clearInterval(watchdog);
    frame = null;
    watchdog = null;
    if (track) track.onended = null;
    stopStream(stream);
    await meter?.close();
    deviceOwner.release("voice-recorder");
  };

  try {
    recorder.start(250);
  } catch (error) {
    await teardown();
    throw error;
  }

  return {
    mimeType: recorder.mimeType || preferred,
    canPause: typeof recorder.pause === "function" && typeof recorder.resume === "function",
    isPaused: () => paused,
    elapsedMs,
    readings: () => readings,
    // The clock only stops if the encoder actually stopped: a refused pause that
    // froze the timer would persist a duration shorter than the audio.
    pause: () => {
      if (paused || closed || recorder.state !== "recording") return;
      try {
        recorder.pause();
      } catch {
        return;
      }
      accumulatedMs += performance.now() - segmentStart;
      paused = true;
    },
    resume: () => {
      if (!paused || closed) return;
      try {
        recorder.resume();
      } catch {
        return;
      }
      segmentStart = performance.now();
      paused = false;
    },
    stop: async () => {
      const durationMs = Math.round(elapsedMs());
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopping */
        }
      }
      await stopped;
      const produced = normalizeMime(recorder.mimeType || preferred);
      await teardown();

      const blob = new Blob(chunks, { type: produced });
      if (blob.size < 1) return { ok: false, reason: "empty" };
      if (durationMs < MIN_VOICE_MESSAGE_MS) return { ok: false, reason: "too-short" };

      return {
        ok: true,
        recording: {
          file: toVoiceFile(blob, produced),
          mimeType: produced,
          durationMs: Math.min(durationMs, MAX_VOICE_MESSAGE_MS),
          waveform: compressWaveform(readings),
          readings: [...readings],
        },
      };
    },
    cancel: async () => {
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopping */
        }
      }
      await stopped;
      chunks.length = 0;
      await teardown();
    },
  };
}
