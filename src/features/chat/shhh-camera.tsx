"use client";

import { Flashlight, FlashlightOff, RotateCcw, SwitchCamera, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { lockPageScroll } from "@/components/shhh/scroll-lock";
import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { createShutterGesture, MAX_RECORD_MS } from "@/features/chat/shutter-gesture";
import { captureCameraStill } from "@/lib/media/camera-capture";
import {
  isShhhCameraSupported,
  startCameraRecording,
  type ActiveCameraRecording,
} from "@/lib/media/camera-recorder";
import { captureErrorStatus } from "@/lib/media/capture-errors";
import { deviceOwner } from "@/lib/media/device-owner";
import { formatDurationMs } from "@/lib/media/duration";
import { cn } from "@/lib/utils";

export type CameraFacing = "environment" | "user";

type CameraStatus = "requesting" | "live" | "denied" | "missing" | "busy" | "failed" | "held";

type ShhhCameraProps = {
  initialFacing?: CameraFacing;
  onClose: () => void;
  onCapture: (files: File[]) => void;
  onFacingChange?: (facing: CameraFacing) => void;
};

function cameraErrorStatus(error: unknown): Exclude<CameraStatus, "requesting" | "live" | "held"> {
  const status = captureErrorStatus(error);
  return status === "unsupported" ? "failed" : status;
}

function statusCopy(status: CameraStatus): { title: string; body: string } {
  if (status === "requesting") {
    return {
      title: "Shhh needs camera access to take photos and videos.",
      body: "Allow the camera to continue.",
    };
  }
  if (status === "denied") {
    return {
      title: "Camera access is off.",
      body: "Turn it on in your browser settings to take photos and videos.",
    };
  }
  if (status === "missing") {
    return {
      title: "No camera found.",
      body: "Connect a camera, or choose something from Media instead.",
    };
  }
  if (status === "busy") {
    return {
      title: "Something else is using the camera.",
      body: "Close the other app or tab, then try again.",
    };
  }
  if (status === "held") {
    return {
      title: "Finish the call first.",
      body: "The camera stays with the call until it ends.",
    };
  }
  return {
    title: "Couldn't open the camera.",
    body: "Try again in a moment.",
  };
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function trackHasTorch(track: MediaStreamTrack): boolean {
  const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
  return Boolean(capabilities?.torch);
}

async function applyTorch(track: MediaStreamTrack, on: boolean) {
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as unknown as MediaTrackConstraintSet],
    });
  } catch {
    /* iPhone never exposes torch; ignore */
  }
}

async function getCameraStream(facing: CameraFacing, audio: boolean): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    facingMode: { ideal: facing },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };
  return navigator.mediaDevices.getUserMedia({ video, audio });
}

export function ShhhCamera({
  initialFacing = "environment",
  onClose,
  onCapture,
  onFacingChange,
}: ShhhCameraProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef<ActiveCameraRecording | null>(null);
  const gestureRef = useRef(createShutterGesture());
  const tickRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("requesting");
  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [phase, setPhase] = useState<"idle" | "pressing" | "recording">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useFocusTrap(
    rootRef,
    status === "live" || status === "denied" || status === "missing" || status === "failed",
  );

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      window.cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const closeStreams = useCallback(async () => {
    stopTick();
    const active = recordingRef.current;
    recordingRef.current = null;
    if (active) {
      try {
        await active.stop();
      } catch {
        /* closing */
      }
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    deviceOwner.release("camera");
  }, [stopTick]);

  const attachStream = useCallback(async (next: MediaStream) => {
    stopStream(streamRef.current);
    streamRef.current = next;
    const video = videoRef.current;
    if (video) {
      video.srcObject = next;
      try {
        await video.play();
      } catch {
        /* autoplay can wait for a gesture */
      }
    }
    const videoTrack = next.getVideoTracks()[0];
    setTorchAvailable(videoTrack ? trackHasTorch(videoTrack) : false);
    setTorchOn(false);
  }, []);

  const startLive = useCallback(
    async (nextFacing: CameraFacing, keepLive = false) => {
      if (!isShhhCameraSupported()) {
        setStatus("failed");
        return;
      }
      const claim = deviceOwner.claim("camera");
      if (!claim.ok) {
        setStatus("held");
        return;
      }
      if (!keepLive) setStatus("requesting");
      setHint(null);
      try {
        let stream: MediaStream;
        try {
          stream = await getCameraStream(nextFacing, true);
        } catch (error) {
          if (cameraErrorStatus(error) === "denied") {
            stream = await getCameraStream(nextFacing, false);
          } else {
            throw error;
          }
        }
        await attachStream(stream);
        setFacing(nextFacing);
        onFacingChange?.(nextFacing);
        setStatus("live");
      } catch (error) {
        stopStream(streamRef.current);
        streamRef.current = null;
        deviceOwner.release("camera");
        setStatus(cameraErrorStatus(error));
      }
    },
    [attachStream, onFacingChange],
  );

  // Opening the camera is an external device subscription; status is the live/denied UI.
  /* eslint-disable react-hooks/set-state-in-effect -- getUserMedia lifecycle */
  useEffect(() => {
    void startLive(initialFacing);
    return () => {
      void closeStreams();
    };
    // Remounted each time the camera opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return deviceOwner.subscribe((owner) => {
      if (owner === "call") {
        void closeStreams();
        setStatus("held");
      }
    });
  }, [closeStreams]);

  useEffect(() => lockPageScroll(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "recording") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const finishRecording = useCallback(async () => {
    const active = recordingRef.current;
    recordingRef.current = null;
    setPhase("idle");
    setElapsedMs(0);
    if (!active) return;
    const file = await active.stop();
    if (!file) {
      setHint("That clip was too short. Hold a little longer.");
      return;
    }
    onCapture([file]);
  }, [onCapture]);

  const takePhoto = useCallback(async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!video || !track) {
      setHint("Couldn't take that photo. Try again.");
      return;
    }
    try {
      const file = await captureCameraStill({ video, track });
      onCapture([file]);
    } catch {
      setHint("Couldn't take that photo. Try again.");
    }
  }, [onCapture]);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      recordingRef.current = startCameraRecording(stream);
    } catch {
      recordingRef.current = null;
      setPhase("idle");
      setHint("Couldn't record that. Try again.");
    }
  }, []);

  function onShutterPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || status !== "live" || busyRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHint(null);
    gestureRef.current.pointerDown(event.clientX, event.clientY, performance.now());
    setPhase("pressing");
    stopTick();
    const loop = () => {
      const tickEvent = gestureRef.current.tick(performance.now());
      setElapsedMs(gestureRef.current.elapsedMs(performance.now()));
      if (tickEvent?.type === "record-start") {
        setPhase("recording");
        beginRecording();
      } else if (tickEvent?.type === "record-stop") {
        stopTick();
        void finishRecording();
        return;
      }
      tickRef.current = window.requestAnimationFrame(loop);
    };
    tickRef.current = window.requestAnimationFrame(loop);
  }

  function onShutterPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const result = gestureRef.current.pointerMove(event.clientX, event.clientY);
    if (result?.type === "cancel") {
      stopTick();
      setPhase("idle");
      setElapsedMs(0);
    }
  }

  async function onShutterPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (busyRef.current) return;
    const result = gestureRef.current.pointerUp(performance.now());
    stopTick();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (result?.type === "photo") {
      setPhase("idle");
      busyRef.current = true;
      await takePhoto();
      busyRef.current = false;
      return;
    }
    if (result?.type === "record-stop") {
      busyRef.current = true;
      await finishRecording();
      busyRef.current = false;
    }
  }

  function onShutterPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const result = gestureRef.current.pointerCancel(performance.now());
    stopTick();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (result?.type === "record-stop") {
      void finishRecording();
      return;
    }
    setPhase("idle");
    setElapsedMs(0);
  }

  async function flipCamera() {
    if (phase === "recording") return;
    const next: CameraFacing = facing === "environment" ? "user" : "environment";
    await startLive(next, true);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    await applyTorch(track, next);
    setTorchOn(next);
  }

  if (typeof document === "undefined") return null;

  const copy = statusCopy(status);
  const recording = phase === "recording";
  const ringProgress = Math.min(1, elapsedMs / MAX_RECORD_MS);
  const circumference = 2 * Math.PI * 38;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      data-testid="shhh-camera"
      data-facing={facing}
      data-recording={recording ? "true" : "false"}
      data-phase={phase}
      className="fixed inset-0 z-[80] bg-[var(--shhh-viewer-ink)] text-[var(--shhh-viewer-ivory)]"
    >
      <video
        ref={videoRef}
        data-testid="shhh-camera-preview"
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 size-full object-cover",
          facing === "user" && "-scale-x-100",
          status !== "live" && "opacity-0",
        )}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--shhh-viewer-ink) 42%, transparent) 0%, transparent 18%, transparent 62%, color-mix(in srgb, var(--shhh-viewer-ink) 58%, transparent) 100%)",
        }}
        aria-hidden
      />

      {status !== "live" ? (
        <div
          data-testid={status === "denied" ? "shhh-camera-denied" : "shhh-camera-status"}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-8 text-center"
        >
          <p className="max-w-xs text-lg leading-snug font-semibold">{copy.title}</p>
          <p className="text-sm leading-relaxed text-[var(--shhh-viewer-ivory)]/70">{copy.body}</p>
        </div>
      ) : null}

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[calc(var(--shhh-safe-top)+0.7rem)]">
        <button
          type="button"
          data-testid="shhh-camera-close"
          aria-label="Close camera"
          className="shhh-press grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_46%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm"
          onClick={onClose}
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>
        {recording ? (
          <p
            data-testid="shhh-camera-timer"
            aria-live="polite"
            className="rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent)] px-3 py-1 text-sm font-semibold tabular-nums backdrop-blur-sm"
          >
            {formatDurationMs(elapsedMs) || "0:00"}
          </p>
        ) : (
          <span />
        )}
        {torchAvailable ? (
          <button
            type="button"
            data-testid="shhh-camera-flash"
            aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
            aria-pressed={torchOn}
            className="shhh-press grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_46%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm"
            onClick={() => void toggleTorch()}
          >
            {torchOn ? (
              <Flashlight className="size-5" strokeWidth={2.2} />
            ) : (
              <FlashlightOff className="size-5" strokeWidth={2.2} />
            )}
          </button>
        ) : (
          <span className="size-11" />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-6 pt-6 pb-[calc(var(--shhh-safe-bottom)+1.35rem)]">
        {hint ? (
          <p className="text-center text-sm text-[var(--shhh-viewer-ivory)]/80" data-testid="shhh-camera-hint">
            {hint}
          </p>
        ) : recording ? (
          <p className="text-center text-xs font-medium tracking-wide text-[var(--shhh-viewer-ivory)]/70">
            Recording
          </p>
        ) : (
          <p className="text-center text-xs font-medium tracking-wide text-[var(--shhh-viewer-ivory)]/55">
            Tap for photo · Hold for video
          </p>
        )}
        <div className="flex w-full items-center justify-between">
          <span className="size-11" />
          <button
            type="button"
            data-testid="shhh-camera-shutter"
            aria-label="Take a photo, or hold for video"
            disabled={status !== "live"}
            className="relative grid size-[4.75rem] touch-none place-items-center rounded-full select-none disabled:opacity-40"
            style={{ touchAction: "none" }}
            onPointerDown={onShutterPointerDown}
            onPointerMove={onShutterPointerMove}
            onPointerUp={(event) => void onShutterPointerUp(event)}
            onPointerCancel={onShutterPointerCancel}
          >
            <svg viewBox="0 0 84 84" className="absolute inset-0 size-full -rotate-90" aria-hidden>
              <circle
                cx="42"
                cy="42"
                r="38"
                fill="none"
                stroke="color-mix(in srgb, var(--shhh-viewer-ivory) 28%, transparent)"
                strokeWidth="3"
              />
              {recording ? (
                <circle
                  cx="42"
                  cy="42"
                  r="38"
                  fill="none"
                  stroke="var(--shhh-love)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - ringProgress)}
                  className="motion-reduce:hidden"
                />
              ) : null}
            </svg>
            <span
              className={cn(
                "block rounded-full bg-[var(--shhh-viewer-ivory)] shadow-[var(--shhh-shadow-soft)] transition-transform duration-[var(--shhh-motion-fast)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
                phase === "pressing" && "scale-[0.88]",
                recording
                  ? "size-10 bg-[color-mix(in_srgb,var(--shhh-love)_88%,var(--shhh-viewer-ivory))]"
                  : "size-[3.35rem]",
              )}
            />
          </button>
          <button
            type="button"
            data-testid="shhh-camera-flip"
            aria-label="Switch camera"
            disabled={status !== "live" || recording}
            className="shhh-press grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_46%,transparent)] text-[var(--shhh-viewer-ivory)] backdrop-blur-sm disabled:opacity-40"
            onClick={() => void flipCamera()}
          >
            <SwitchCamera className="size-5" strokeWidth={2.2} />
          </button>
        </div>
        {status !== "live" && status !== "requesting" ? (
          <button
            type="button"
            className="shhh-press inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ivory)_16%,transparent)] px-4 py-2 text-sm font-semibold"
            onClick={() => void startLive(facing)}
          >
            <RotateCcw className="size-4" strokeWidth={2.2} />
            Try again
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
