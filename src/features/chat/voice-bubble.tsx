"use client";

import { Loader2, Pause, Play, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ShhhIconButton } from "@/components/shhh";
import { VoiceScrubber } from "@/features/chat/voice-scrubber";
import type { BubbleGroup, ChatMediaItem, MessageSendStatus } from "@/lib/chat/types";
import { CONSUMER_AUDIO_ERRORS } from "@/lib/media/consumer-errors";
import { formatDurationMs } from "@/lib/media/duration";
import { claimPlayback, releasePlayback } from "@/lib/media/playback-coordinator";
import { playMediaElement } from "@/lib/media/play-media";
import { saveMediaOriginal } from "@/lib/media/save-original";
import { getSignedMediaUrl } from "@/lib/media/signed-url-cache";
import { loadVoiceRate, saveVoiceRate } from "@/lib/media/voice-rate";
import { voiceTrackWidthRem, WAVEFORM_MIN_BAR } from "@/lib/media/waveform";
import { uploadManager } from "@/lib/uploads/manager";
import { cn } from "@/lib/utils";
import { VOICE_PLAYBACK_RATES, type VoicePlaybackRate } from "@/lib/media/validation";

type VoiceBubbleProps = {
  media: ChatMediaItem;
  isOwn: boolean;
  group: BubbleGroup;
  senderName: string;
  progress?: number;
  sendStatus?: MessageSendStatus;
  /** Set only while the message is still a local optimistic row. */
  clientGeneratedId?: string;
};

function bubbleRadius(isOwn: boolean, group: BubbleGroup) {
  if (isOwn) {
    if (group === "first") return "rounded-[1.4rem_1.35rem_0.65rem_1.4rem]";
    if (group === "middle") return "rounded-[1.4rem_0.7rem_0.7rem_1.4rem]";
    if (group === "last") return "rounded-[1.4rem_0.7rem_0.5rem_1.4rem]";
    return "rounded-[1.4rem_1.35rem_0.5rem_1.4rem]";
  }
  if (group === "first") return "rounded-[1.35rem_1.4rem_1.4rem_0.7rem]";
  if (group === "middle") return "rounded-[0.7rem_1.4rem_1.4rem_0.7rem]";
  if (group === "last") return "rounded-[0.7rem_1.4rem_1.4rem_0.5rem]";
  return "rounded-[1.35rem_1.4rem_1.4rem_0.5rem]";
}

function sendingLabel(progress: number, status?: MessageSendStatus) {
  if (status === "queued") return CONSUMER_AUDIO_ERRORS.WAITING;
  if (status === "preparing" || progress < 2) return "Sending…";
  if (progress >= 99) return "Finishing…";
  return `Sending ${Math.round(progress)}%`;
}

function nextRate(rate: VoicePlaybackRate): VoicePlaybackRate {
  const index = VOICE_PLAYBACK_RATES.indexOf(rate);
  return VOICE_PLAYBACK_RATES[(index + 1) % VOICE_PLAYBACK_RATES.length]!;
}

function rateLabel(rate: VoicePlaybackRate) {
  return rate === 1 ? "1×" : `${rate}×`;
}

/**
 * A voice note in the thread: press play, watch the bars fill, drag to move.
 *
 * The signed URL is only fetched on the first press, so a thread full of voice
 * messages costs nothing until one is actually listened to.
 */
export function VoiceBubble({
  media,
  isOwn,
  group,
  senderName,
  progress,
  sendStatus,
  clientGeneratedId,
}: VoiceBubbleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  /** True only between "press play" and the fetched src being ready to start. */
  const loadingPlayRef = useRef(false);
  const [src, setSrc] = useState<string | null>(media.localObjectUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playedMs, setPlayedMs] = useState(0);
  /** Listened to or dragged in this session — speed stays available after a scrub. */
  const [touched, setTouched] = useState(false);
  /** Finished this listen — show replay until the next play, but keep the clock as total. */
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rate, setRate] = useState<VoicePlaybackRate>(1);

  const durationMs = media.durationMs ?? 0;
  const samples = media.waveform?.length ? media.waveform : [WAVEFORM_MIN_BAR];
  const sending =
    sendStatus !== "failed" && typeof progress === "number" && progress >= 0 && progress < 100;
  /** Your own note is playable from the local file while it is still uploading. */
  const locked = sending && !src;
  const trackWidth = voiceTrackWidthRem(durationMs);
  const fraction = durationMs > 0 ? Math.min(1, playedMs / durationMs) : 0;
  const remainingMs = Math.max(0, durationMs - playedMs);
  const timeLabel = playing ? remainingMs : durationMs;
  const showSpeed = !sending && !failed && (playing || (touched && !finished));
  const showSave = failed || (!sending && !isOwn && (playing || finished));

  useEffect(() => {
    let active = true;
    void loadVoiceRate().then((stored) => {
      if (active) setRate(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const node = audioRef.current;
    if (node) node.playbackRate = rate;
  }, [rate, src]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    return () => releasePlayback(media.id);
  }, [media.id]);

  function startPlayback(node: HTMLAudioElement) {
    if (finished || fraction >= 1) node.currentTime = 0;
    node.playbackRate = rate;
    claimPlayback(media.id, pause);
    playMediaElement(node, () => {
      setFailed(true);
      releasePlayback(media.id);
    });
  }

  async function toggle() {
    const node = audioRef.current;

    if (node && !node.paused && src && !failed) {
      node.pause();
      return;
    }

    if (failed) {
      setFailed(false);
      setSrc(null);
      if (node) {
        node.removeAttribute("src");
        node.load();
      }
    }

    if (!src || failed) {
      setLoading(true);
      loadingPlayRef.current = true;
      try {
        const url = await getSignedMediaUrl(media.id, "original");
        setSrc(url);
        const el = audioRef.current;
        if (el) {
          el.src = url;
          startPlayback(el);
        }
      } catch {
        loadingPlayRef.current = false;
        setFailed(true);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!node) return;
    startPlayback(node);
  }

  async function save() {
    setSaveError(null);
    setSaving(true);
    try {
      await saveMediaOriginal({
        mediaId: media.id,
        fallbackFilename: media.originalFilename ?? "Voice message.m4a",
        mimeType: media.mimeType || "audio/mp4",
        shareTitle: "Voice message",
        localObjectUrl: media.localObjectUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSaveError("Couldn't save this voice message.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="voice-bubble"
      data-side={isOwn ? "outgoing" : "incoming"}
      data-playing={playing ? "true" : "false"}
      className={cn(
        "relative flex w-max max-w-full min-w-0 items-center gap-2 overflow-hidden px-2 py-1.5 shadow-[var(--shhh-shadow-soft)]",
        isOwn ? "bg-outgoing-bubble" : "bg-incoming-bubble",
        bubbleRadius(isOwn, group),
      )}
    >
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        aria-hidden
        className="pointer-events-none absolute size-0 overflow-hidden opacity-0 !block"
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
          if (loadingPlayRef.current) {
            loadingPlayRef.current = false;
            startPlayback(event.currentTarget);
          }
        }}
          onPlay={() => {
            loadingPlayRef.current = false;
            setPlaying(true);
            setTouched(true);
            setFinished(false);
            setFailed(false);
          }}
        onPause={() => {
          setPlaying(false);
          releasePlayback(media.id);
        }}
        onEnded={() => {
          setPlaying(false);
          setPlayedMs(0);
          setFinished(true);
          releasePlayback(media.id);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={(event) => setPlayedMs(event.currentTarget.currentTime * 1000)}
        onError={() => {
          if (!audioRef.current?.currentSrc) return;
          setFailed(true);
          setPlaying(false);
          releasePlayback(media.id);
        }}
      />

      <ShhhIconButton
        type="button"
        label={
          failed
            ? CONSUMER_AUDIO_ERRORS.UNSUPPORTED_PLAYBACK
            : playing
              ? `Pause voice message from ${senderName}`
              : finished
                ? `Replay voice message from ${senderName}`
                : `Play voice message from ${senderName}`
        }
        data-testid="voice-play"
        data-message-gesture-ignore
        disabled={locked}
        className="bg-accent-soft text-accent-strong size-10 shrink-0"
        onClick={() => void toggle()}
      >
        {loading || buffering ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        ) : playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : finished ? (
          <RotateCcw className="size-4" strokeWidth={2.2} />
        ) : (
          <Play className="ms-0.5 size-4" fill="currentColor" strokeWidth={0} />
        )}
      </ShhhIconButton>

      {failed ? (
        <p className="text-secondary-text max-w-[12rem] text-xs leading-snug">
          {CONSUMER_AUDIO_ERRORS.UNSUPPORTED_PLAYBACK}
        </p>
      ) : (
        <VoiceScrubber
          samples={samples}
          progress={finished ? 0 : fraction}
          durationMs={durationMs}
          label={`Voice message from ${senderName}`}
          widthRem={trackWidth}
          disabled={locked}
          onSeek={(next) => {
            const node = audioRef.current;
            const ms = next * durationMs;
            setPlayedMs(ms);
            setTouched(true);
            setFinished(false);
            if (node) node.currentTime = ms / 1000;
          }}
        />
      )}

      <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "text-muted-text text-end text-[11px] font-medium tabular-nums",
            sending ? "max-w-[9rem] text-start" : "min-w-[3.5ch]",
          )}
          data-testid="voice-time"
        >
          {sending
            ? sendingLabel(progress ?? 0, sendStatus)
            : formatDurationMs(timeLabel) || "0:00"}
        </span>
        {showSpeed ? (
          <button
            type="button"
            data-testid="voice-rate"
            data-message-gesture-ignore
            aria-label={`Playback speed ${rateLabel(rate)}. Tap to change.`}
            className={cn(
              "shhh-press text-accent rounded-pill min-h-7 px-1.5",
              "text-[11px] font-semibold tabular-nums",
            )}
            onClick={() => {
              const next = nextRate(rate);
              setRate(next);
              const node = audioRef.current;
              if (node) node.playbackRate = next;
              void saveVoiceRate(next);
            }}
          >
            {rateLabel(rate)}
          </button>
        ) : null}
        {showSave ? (
          <button
            type="button"
            data-testid="voice-save"
            data-message-gesture-ignore
            aria-label="Save audio"
            disabled={saving}
            title={saveError ?? undefined}
            className="shhh-press text-muted-text hover:text-accent min-h-7 px-1 text-[11px] font-medium disabled:opacity-60"
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save audio"}
          </button>
        ) : null}
      </div>

      {sending && clientGeneratedId ? (
        <button
          type="button"
          data-testid="voice-cancel-send"
          data-message-gesture-ignore
          aria-label="Stop sending this voice message"
          className="shhh-press text-muted-text hover:text-danger grid size-8 place-items-center rounded-full"
          onClick={() => void uploadManager.cancel(clientGeneratedId)}
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}
