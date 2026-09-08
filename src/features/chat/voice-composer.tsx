"use client";

import { ArrowUp, Mic, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ShhhButton, ShhhIconButton } from "@/components/shhh";
import { VoiceScrubber } from "@/features/chat/voice-scrubber";
import { WaveformBars } from "@/features/chat/waveform-bars";
import { CONSUMER_AUDIO_ERRORS } from "@/lib/media/consumer-errors";
import { formatDurationMs } from "@/lib/media/duration";
import { playMediaElement } from "@/lib/media/play-media";
import { MAX_VOICE_MESSAGE_MS, MIN_VOICE_MESSAGE_MS } from "@/lib/media/validation";
import {
  isVoiceRecordingSupported,
  startVoiceRecording,
  voiceErrorStatus,
  type ActiveVoiceRecording,
  type VoiceRecorderErrorStatus,
  type VoiceRecordingResult,
} from "@/lib/media/voice-recorder";
import { recentWaveform, WAVEFORM_MIN_BAR } from "@/lib/media/waveform";
import { cn } from "@/lib/utils";

type VoiceComposerProps = {
  onSend: (recording: VoiceRecordingResult) => void;
  onClose: () => void;
  disabled?: boolean;
};

type Phase = "starting" | "recording" | "paused" | "preview" | "blocked";

const LIVE_BARS = 34;
/** Enough for a live feel without re-rendering the tree every frame. */
const UI_TICK_MS = 60;
/** The countdown only appears when the cap is actually close. */
const COUNTDOWN_FROM_MS = 30_000;

/** Same footprint as the idle text composer — recording and preview share this. */
const SHELL =
  "bg-composer animate-shhh-settle rounded-[1.75rem] px-2 py-2 shadow-[var(--shhh-shadow-float)] motion-reduce:animate-none";

function blockedCopy(status: VoiceRecorderErrorStatus): { title: string; body: string } {
  if (status === "denied") {
    return {
      title: CONSUMER_AUDIO_ERRORS.MIC_DENIED,
      body: "Turn it on in your browser settings to send voice messages.",
    };
  }
  if (status === "missing") {
    return {
      title: CONSUMER_AUDIO_ERRORS.MIC_MISSING,
      body: "Connect a microphone, then try again.",
    };
  }
  if (status === "busy") {
    return {
      title: CONSUMER_AUDIO_ERRORS.MIC_BUSY,
      body: "Close the other app or tab, then try again.",
    };
  }
  if (status === "unsupported") {
    return {
      title: CONSUMER_AUDIO_ERRORS.UNSUPPORTED,
      body: "Safari on iPhone and Chrome both work.",
    };
  }
  return { title: CONSUMER_AUDIO_ERRORS.RECORD_FAILED, body: "Try again in a moment." };
}

function tap(pattern: number | number[]) {
  // iPhone Safari has no vibration API; treat it as a bonus, never a requirement.
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/**
 * Recording, then listening back before it goes anywhere.
 *
 * Mounted in place of the text composer while a voice message is being made, and
 * unmounted the moment it is sent or discarded — which is what releases the
 * microphone, on every exit path including navigating away mid-recording.
 */
export function VoiceComposer({ onSend, onClose, disabled }: VoiceComposerProps) {
  const activeRef = useRef<ActiveVoiceRecording | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const finishingRef = useRef(false);

  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("starting");
  const [blocked, setBlocked] = useState<VoiceRecorderErrorStatus>("failed");
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(() =>
    new Array(LIVE_BARS).fill(WAVEFORM_MIN_BAR),
  );
  const [canPause, setCanPause] = useState(false);
  const [recording, setRecording] = useState<VoiceRecordingResult | null>(null);
  const [playedMs, setPlayedMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const active = activeRef.current;
      if (!active) return;
      const now = performance.now();
      if (now - lastTickRef.current >= UI_TICK_MS) {
        lastTickRef.current = now;
        setElapsedMs(active.elapsedMs());
        setLiveBars(recentWaveform(active.readings(), LIVE_BARS));
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  /** Stop and land in preview. Returns false when there was nothing worth keeping. */
  const settle = useCallback(
    async (reason?: string) => {
      if (finishingRef.current) return false;
      finishingRef.current = true;
      const active = activeRef.current;
      activeRef.current = null;
      stopLoop();
      if (!active) {
        finishingRef.current = false;
        return false;
      }
      const outcome = await active.stop();
      finishingRef.current = false;
      if (!outcome.ok) {
        // A tap on the mic and an instant stop said nothing — no error worth showing.
        onClose();
        return false;
      }
      tap(8);
      setRecording(outcome.recording);
      setElapsedMs(outcome.recording.durationMs);
      setPlayedMs(0);
      setPlaying(false);
      setNotice(reason ?? null);
      setPhase("preview");
      return true;
    },
    [onClose, stopLoop],
  );

  const previewUrl = useMemo(
    () => (recording ? URL.createObjectURL(recording.file) : null),
    [recording],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // `settle` closes over the parent's callbacks; reading it through a ref keeps a
  // re-rendered parent from restarting a live recording.
  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  }, [settle]);

  // Opening the microphone is an external device subscription; phase is its UI.
  useEffect(() => {
    let cancelled = false;

    async function begin() {
      if (!isVoiceRecordingSupported()) {
        setBlocked("unsupported");
        setPhase("blocked");
        return;
      }
      setPhase("starting");
      setNotice(null);
      setElapsedMs(0);
      setLiveBars(new Array(LIVE_BARS).fill(WAVEFORM_MIN_BAR));
      try {
        const active = await startVoiceRecording({
          onCapReached: () => {
            void settleRef.current("That's the longest a voice message can be.");
          },
          onInterrupted: () => {
            void settleRef.current("The microphone was interrupted.");
          },
        });
        if (cancelled) {
          await active.cancel();
          return;
        }
        activeRef.current = active;
        setCanPause(active.canPause);
        setPhase("recording");
        tap(10);
        startLoop();
      } catch (error) {
        if (cancelled) return;
        setBlocked(voiceErrorStatus(error));
        setPhase("blocked");
      }
    }

    void begin();
    return () => {
      cancelled = true;
      stopLoop();
      const active = activeRef.current;
      activeRef.current = null;
      void active?.cancel();
    };
    // Each attempt opens a fresh microphone session; nothing else may restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Leaving Shhh mid-recording must never lose the take or keep recording unseen.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState !== "hidden") return;
      const active = activeRef.current;
      if (!active || active.isPaused()) return;
      if (active.canPause) {
        active.pause();
        if (active.isPaused()) {
          setPhase("paused");
          setNotice("Paused when you left Shhh.");
          return;
        }
      }
      void settleRef.current("Stopped when you left Shhh.");
    }
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  const discard = useCallback(async () => {
    stopLoop();
    const active = activeRef.current;
    activeRef.current = null;
    await active?.cancel();
    onClose();
  }, [onClose, stopLoop]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void discard();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discard]);

  const remaining = MAX_VOICE_MESSAGE_MS - elapsedMs;
  const tooShort = elapsedMs < MIN_VOICE_MESSAGE_MS;
  const live = phase === "recording" || phase === "paused";

  const hint = notice
    ? notice
    : tooShort && live
      ? CONSUMER_AUDIO_ERRORS.TOO_SHORT
      : remaining <= COUNTDOWN_FROM_MS && live
        ? `${formatDurationMs(remaining) || "0:00"} left`
        : null;

  if (phase === "blocked") {
    const copy = blockedCopy(blocked);
    return (
      <div
        data-testid="voice-blocked"
        className="bg-surface-elevated animate-shhh-settle mx-3 mb-1 rounded-[1.75rem] p-3.5 shadow-[var(--shhh-shadow-float)] motion-reduce:animate-none"
      >
        <p className="text-primary-text text-sm font-semibold">{copy.title}</p>
        <p className="text-muted-text mt-1 text-xs leading-relaxed">{copy.body}</p>
        <div className="mt-3 flex justify-end gap-2">
          <ShhhButton type="button" variant="ghost" onClick={onClose}>
            Not now
          </ShhhButton>
          <ShhhButton
            type="button"
            variant="secondary"
            data-testid="voice-retry-permission"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </ShhhButton>
        </div>
      </div>
    );
  }

  if (phase === "preview" && recording) {
    const progress = recording.durationMs > 0 ? Math.min(1, playedMs / recording.durationMs) : 0;
    return (
      <div className="px-3 pt-1 pb-1">
        <div data-testid="voice-preview" className={SHELL}>
          <audio
            ref={audioRef}
            src={previewUrl ?? undefined}
            preload="metadata"
            aria-hidden
            className="pointer-events-none absolute size-0 overflow-hidden opacity-0 !block"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setPlayedMs(0);
            }}
            onTimeUpdate={(event) => setPlayedMs(event.currentTarget.currentTime * 1000)}
          />
          <div className="flex items-center gap-1.5">
            <ShhhIconButton
              type="button"
              label={playing ? "Pause voice message" : "Play voice message"}
              data-testid="voice-preview-play"
              className="bg-accent-soft text-accent-strong size-11 shrink-0"
              onClick={() => {
                const node = audioRef.current;
                if (!node) return;
                if (node.paused) {
                  if (progress >= 1) node.currentTime = 0;
                  playMediaElement(node);
                } else {
                  node.pause();
                }
              }}
            >
              {playing ? (
                <Pause className="size-4" fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className="ms-0.5 size-4" fill="currentColor" strokeWidth={0} />
              )}
            </ShhhIconButton>
            <VoiceScrubber
              samples={recording.waveform}
              progress={progress}
              durationMs={recording.durationMs}
              label="Your voice message"
              onSeek={(fraction) => {
                const node = audioRef.current;
                const next = fraction * recording.durationMs;
                setPlayedMs(next);
                if (node) node.currentTime = next / 1000;
              }}
            />
            <span className="text-secondary-text w-[4.5ch] shrink-0 text-end text-xs font-semibold tabular-nums">
              {formatDurationMs(recording.durationMs) || "0:00"}
            </span>
          </div>
          {notice ? (
            <p className="text-muted-text mt-1.5 px-1 text-[11px]" data-testid="voice-notice">
              {notice}
            </p>
          ) : null}
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <ShhhIconButton
              type="button"
              label="Discard recording"
              data-testid="voice-discard"
              className="text-muted-text hover:text-danger size-11 shrink-0 bg-transparent shadow-none"
              onClick={() => void discard()}
            >
              <X className="size-4" strokeWidth={2.2} />
            </ShhhIconButton>
            <button
              type="button"
              data-testid="voice-rerecord"
              aria-label="Record again"
              className="shhh-press text-secondary-text hover:text-primary-text flex min-h-11 min-w-0 items-center gap-1 px-1.5 text-xs font-semibold whitespace-nowrap"
              onClick={() => {
                setRecording(null);
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden />
              Record again
            </button>
            <ShhhIconButton
              type="button"
              label="Send voice message"
              data-testid="voice-send"
              disabled={disabled}
              className="bg-button hover:bg-button-strong ms-auto size-11 shrink-0 text-on-button"
              onClick={() => {
                onSend(recording);
                onClose();
              }}
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </ShhhIconButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-1 pb-1">
      <div
        data-testid="voice-recording"
        data-phase={phase}
        className={cn(SHELL, "flex items-center gap-1.5")}
      >
        {phase === "starting" ? (
          <span className="sr-only" aria-live="polite">
            Opening the microphone…
          </span>
        ) : null}
        <ShhhIconButton
          type="button"
          label="Cancel recording"
          data-testid="voice-cancel"
          className="text-muted-text hover:text-danger size-11 shrink-0 bg-transparent shadow-none"
          onClick={() => void discard()}
        >
          <X className="size-4" strokeWidth={2.2} />
        </ShhhIconButton>

        <div className="flex min-w-0 flex-1 items-center gap-2 px-0.5">
          <span
            data-testid="voice-live-dot"
            className={cn(
              "size-2 shrink-0 rounded-full",
              phase === "paused"
                ? "bg-muted-text"
                : "bg-love animate-shhh-quiet-pulse motion-reduce:animate-none",
            )}
            aria-hidden
          />
          <span
            className="text-primary-text inline-block w-[4.5ch] shrink-0 text-sm font-semibold tabular-nums"
            data-testid="voice-timer"
            aria-live="off"
          >
            {formatDurationMs(elapsedMs) || "0:00"}
          </span>
          <div className="h-7 min-w-0 flex-1 overflow-hidden">
            <WaveformBars
              samples={liveBars}
              bars={LIVE_BARS}
              tone="recording"
              className="justify-end"
            />
          </div>
        </div>

        {canPause && live ? (
          <ShhhIconButton
            type="button"
            label={phase === "paused" ? "Resume recording" : "Pause recording"}
            data-testid="voice-pause"
            className="bg-bg-soft text-secondary-text size-11 shrink-0"
            onClick={() => {
              // Follow the engine, not the tap: a refused pause keeps recording.
              const active = activeRef.current;
              if (!active) return;
              if (active.isPaused()) {
                active.resume();
                if (active.isPaused()) return;
                setNotice(null);
                setPhase("recording");
                startLoop();
              } else {
                active.pause();
                if (active.isPaused()) {
                  stopLoop();
                  setPhase("paused");
                }
              }
            }}
          >
            {phase === "paused" ? (
              <Mic className="size-4" strokeWidth={2.2} />
            ) : (
              <Pause className="size-4" fill="currentColor" strokeWidth={0} />
            )}
          </ShhhIconButton>
        ) : null}

        <ShhhIconButton
          type="button"
          label={tooShort ? "Keep talking to send" : "Stop recording"}
          data-testid="voice-stop"
          disabled={phase === "starting"}
          className={cn(
            "size-11 shrink-0",
            tooShort
              ? "bg-bg-soft text-muted-text shadow-none"
              : "bg-bg-soft text-accent-strong ring-accent/40 ring-1",
          )}
          onClick={() => void settle()}
        >
          <Square className="size-3.5" fill="currentColor" strokeWidth={0} />
        </ShhhIconButton>
      </div>

      {hint ? (
        <p
          className="text-muted-text mt-1 px-3 text-center text-[11px]"
          data-testid="voice-hint"
          aria-live="polite"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
