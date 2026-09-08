import { describe, expect, it, vi } from "vitest";

import { CONSUMER_AUDIO_ERRORS, mapMediaErrorToConsumer } from "@/lib/media/consumer-errors";
import {
  claimPlayback,
  pauseActivePlayback,
  releasePlayback,
  resetPlaybackCoordinator,
} from "@/lib/media/playback-coordinator";
import {
  audioBytesLookForged,
  declaredAudioMimeMatchesSniff,
  finalizeVoiceMessageSchema,
  initVoiceUploadSchema,
  isAllowedAudioMime,
  MAX_VOICE_MESSAGE_MS,
  MIN_VOICE_MESSAGE_MS,
  sniffAudioMime,
  validateAudioUploadMeta,
  VOICE_PLAYBACK_RATES,
  VOICE_WAVEFORM_BUCKETS,
  voiceWaveformSchema,
} from "@/lib/media/validation";

const uuid = () => crypto.randomUUID();

function header(bytes: number[]) {
  const buffer = new Uint8Array(32);
  buffer.set(bytes, 0);
  return buffer;
}

describe("audio allowlist", () => {
  it("accepts only what MediaRecorder can produce, codecs stripped", () => {
    expect(isAllowedAudioMime("audio/mp4")).toBe(true);
    expect(isAllowedAudioMime("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedAudioMime("audio/ogg;codecs=opus")).toBe(true);
    expect(isAllowedAudioMime("audio/aac")).toBe(true);
    expect(isAllowedAudioMime("audio/wav")).toBe(false);
    expect(isAllowedAudioMime("audio/mpeg")).toBe(false);
    expect(isAllowedAudioMime("application/octet-stream")).toBe(false);
    expect(isAllowedAudioMime("video/mp4")).toBe(false);
  });

  it("rejects an unsupported format, an empty file, and an oversized one", () => {
    expect(validateAudioUploadMeta({ mimeType: "audio/webm", size: 4_096 })).toEqual({ ok: true });
    expect(validateAudioUploadMeta({ mimeType: "audio/wav", size: 4_096 }).ok).toBe(false);
    expect(validateAudioUploadMeta({ mimeType: "audio/webm", size: 0 }).ok).toBe(false);
    expect(validateAudioUploadMeta({ mimeType: "audio/webm", size: 500 * 1_024 * 1_024 }).ok).toBe(
      false,
    );
  });
});

describe("sniffAudioMime", () => {
  it("recognises each container from its magic bytes", () => {
    expect(sniffAudioMime(header([0x1a, 0x45, 0xdf, 0xa3]))).toBe("audio/webm");
    expect(sniffAudioMime(header([0x4f, 0x67, 0x67, 0x53]))).toBe("audio/ogg");
    expect(
      sniffAudioMime(header([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])),
    ).toBe("audio/mp4");
    expect(sniffAudioMime(header([0xff, 0xf1, 0x50, 0x80]))).toBe("audio/aac");
  });

  it("returns null for bytes it cannot place, and never guesses on a short read", () => {
    expect(sniffAudioMime(header([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(sniffAudioMime(new Uint8Array([0x1a, 0x45]))).toBeNull();
  });

  it("only trusts a declaration that agrees with the bytes", () => {
    expect(declaredAudioMimeMatchesSniff("audio/webm;codecs=opus", "audio/webm")).toBe(true);
    expect(declaredAudioMimeMatchesSniff("audio/mp4", "audio/webm")).toBe(false);
    expect(declaredAudioMimeMatchesSniff("audio/ogg", "audio/ogg")).toBe(true);
    // AAC in an MP4 wrapper and raw ADTS are the same codec either way.
    expect(declaredAudioMimeMatchesSniff("audio/aac", "audio/mp4")).toBe(true);
    expect(declaredAudioMimeMatchesSniff("audio/mp4", "audio/aac")).toBe(true);
    // An unknown container is not treated as a forgery.
    expect(declaredAudioMimeMatchesSniff("audio/webm", null)).toBe(true);
  });

  it("refuses pictures dressed as recordings, but tolerates an untested container", () => {
    const webm = header([0x1a, 0x45, 0xdf, 0xa3]);
    const png = header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = header([0xff, 0xd8, 0xff, 0xe0]);
    // HEIC shares the ftyp box with M4A, so it would otherwise sniff as audio.
    const heic = header([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);

    expect(audioBytesLookForged("audio/webm", webm)).toBe(false);
    expect(audioBytesLookForged("audio/webm", png)).toBe(true);
    expect(audioBytesLookForged("audio/mp4", jpeg)).toBe(true);
    expect(audioBytesLookForged("audio/mp4", heic)).toBe(true);
    expect(audioBytesLookForged("audio/mp4", header([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    // Nothing recognisable: an engine we never got to test, not an attack.
    expect(audioBytesLookForged("audio/mp4", header([0x01, 0x02, 0x03, 0x04]))).toBe(false);
  });
});

describe("voice schemas", () => {
  const validInit = {
    clientGeneratedId: uuid(),
    clientAssetId: uuid(),
    mediaFolderId: uuid(),
    mimeType: "audio/webm;codecs=opus",
    size: 40_000,
    durationMs: 4_000,
  };

  it("accepts a well-formed init and rejects an out-of-range duration", () => {
    expect(initVoiceUploadSchema.safeParse(validInit).success).toBe(true);
    expect(
      initVoiceUploadSchema.safeParse({ ...validInit, durationMs: MIN_VOICE_MESSAGE_MS - 1 })
        .success,
    ).toBe(false);
    expect(
      initVoiceUploadSchema.safeParse({ ...validInit, durationMs: MAX_VOICE_MESSAGE_MS + 1 })
        .success,
    ).toBe(false);
    expect(initVoiceUploadSchema.safeParse({ ...validInit, size: 0 }).success).toBe(false);
    expect(initVoiceUploadSchema.safeParse({ ...validInit, clientAssetId: "nope" }).success).toBe(
      false,
    );
  });

  it("strips unknown keys so a client cannot smuggle a storage key", () => {
    const parsed = initVoiceUploadSchema.parse({ ...validInit, storageKey: "../../etc/passwd" });
    expect(parsed).not.toHaveProperty("storageKey");
  });

  it("bounds the waveform payload", () => {
    expect(voiceWaveformSchema.safeParse([0, 50, 100]).success).toBe(true);
    expect(voiceWaveformSchema.safeParse([]).success).toBe(false);
    expect(voiceWaveformSchema.safeParse([101]).success).toBe(false);
    expect(voiceWaveformSchema.safeParse([-1]).success).toBe(false);
    expect(voiceWaveformSchema.safeParse([1.5]).success).toBe(false);
    expect(
      voiceWaveformSchema.safeParse(new Array(VOICE_WAVEFORM_BUCKETS * 4 + 1).fill(10)).success,
    ).toBe(false);
  });

  it("requires an upload id and a waveform to finalize", () => {
    const valid = {
      clientGeneratedId: uuid(),
      uploadId: uuid(),
      durationMs: 3_000,
      waveform: new Array(VOICE_WAVEFORM_BUCKETS).fill(40),
    };
    expect(finalizeVoiceMessageSchema.safeParse(valid).success).toBe(true);
    expect(finalizeVoiceMessageSchema.safeParse({ ...valid, uploadId: "x" }).success).toBe(false);
    expect(finalizeVoiceMessageSchema.safeParse({ ...valid, waveform: [] }).success).toBe(false);
  });

  it("offers only speeds that stay intelligible", () => {
    expect(VOICE_PLAYBACK_RATES).toEqual([1, 1.5, 2]);
  });
});

describe("audio error copy", () => {
  it("maps server rejections to something a person can act on", () => {
    expect(mapMediaErrorToConsumer("That audio format isn't supported yet.")).toBe(
      CONSUMER_AUDIO_ERRORS.UNSUPPORTED_FORMAT,
    );
    expect(mapMediaErrorToConsumer("This voice message is too long to send.")).toBe(
      CONSUMER_AUDIO_ERRORS.TOO_LARGE,
    );
    expect(mapMediaErrorToConsumer("Couldn't prepare this voice message.")).toBe(
      CONSUMER_AUDIO_ERRORS.PLAYBACK,
    );
    // Audio copy must not be rewritten as photo copy on the way out.
    for (const copy of Object.values(CONSUMER_AUDIO_ERRORS)) {
      expect(mapMediaErrorToConsumer(copy)).toBe(copy);
    }
  });

  it("never leaks an internal message", () => {
    const copy = mapMediaErrorToConsumer(
      "R2 PutObject failed: signature mismatch for key conv/abc/original",
    );
    expect(copy).not.toMatch(/R2|signature|conv\//u);
    expect(copy).toBe(CONSUMER_AUDIO_ERRORS.SEND_FAILED);
  });
});

describe("playback coordinator", () => {
  it("pauses whoever held the floor when something else plays", () => {
    resetPlaybackCoordinator();
    const first = vi.fn();
    const second = vi.fn();
    claimPlayback("voice-a", first);
    expect(first).not.toHaveBeenCalled();

    claimPlayback("voice-b", second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    // Re-claiming the same id (a seek mid-play) must not pause itself.
    claimPlayback("voice-b", second);
    expect(second).not.toHaveBeenCalled();
  });

  it("pauses on demand and stays quiet once released", () => {
    resetPlaybackCoordinator();
    const pause = vi.fn();
    claimPlayback("voice-a", pause);
    releasePlayback("voice-a");
    pauseActivePlayback();
    expect(pause).not.toHaveBeenCalled();

    claimPlayback("voice-a", pause);
    pauseActivePlayback();
    expect(pause).toHaveBeenCalledTimes(1);
    pauseActivePlayback();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("ignores a release from something that no longer holds the floor", () => {
    resetPlaybackCoordinator();
    const first = vi.fn();
    const second = vi.fn();
    claimPlayback("voice-a", first);
    claimPlayback("voice-b", second);
    releasePlayback("voice-a");
    pauseActivePlayback();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("hands the floor over even when the previous holder throws", () => {
    resetPlaybackCoordinator();
    const angry = vi.fn(() => {
      throw new Error("element detached");
    });
    const next = vi.fn();
    claimPlayback("voice-a", angry);
    expect(() => claimPlayback("voice-b", next)).not.toThrow();

    pauseActivePlayback();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
