"use client";

/* eslint-disable react-hooks/refs -- callback refs attach LiveKit tracks */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ChevronDown } from "lucide-react";

import { lockPageScroll } from "@/components/shhh/scroll-lock";
import { useFocusTrap } from "@/components/shhh/use-focus-trap";
import { AudioCallSurface } from "@/features/calls/audio-call-surface";
import { IncomingCall } from "@/features/calls/incoming-call";
import { OutgoingCall } from "@/features/calls/outgoing-call";
import { VideoCallSurface } from "@/features/calls/video-call-surface";
import { useCallSession } from "@/features/calls/call-session-provider";
import { isLiveCallStatus } from "@/lib/calls/config";
import { cameraErrorCopy, microphoneErrorCopy } from "@/lib/media/capture-errors";
import { cn } from "@/lib/utils";

function statusLabel(status: string, type: "audio" | "video", reconnecting: boolean) {
  if (reconnecting || status === "reconnecting") return "Reconnecting…";
  if (status === "connecting") return "Connecting…";
  if (status === "connected") return type === "video" ? "Video call" : "On a call";
  if (status === "ringing") return type === "video" ? "Video calling…" : "Calling…";
  return "Couldn't connect the call.";
}

export function CallSurface() {
  const session = useCallSession();
  const {
    call,
    minimized,
    partnerName,
    selfName,
    muted,
    cameraOn,
    network,
    permission,
    continueWithoutVideo,
    autoplayBlocked,
    error,
    durationLabel,
    media,
  } = session;
  const rootRef = useRef<HTMLDivElement>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const open = Boolean(call && isLiveCallStatus(call.status) && !minimized);

  useFocusTrap(rootRef, open);
  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      session.setMinimized(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, session]);

  if (!open || !call || typeof document === "undefined") return null;

  const failed = Boolean(error) && call.status !== "connected";
  const incoming = call.status === "ringing" && call.role === "callee";
  const outgoing = call.status === "ringing" && call.role === "caller";
  const video = call.type === "video" && !incoming && !outgoing;
  const permissionCopy = permission
    ? call.type === "video" && permission !== "denied"
      ? cameraErrorCopy(permission)
      : microphoneErrorCopy(permission)
    : null;

  return createPortal(
    <div
      ref={rootRef}
      id="shhh-call-surface"
      role="dialog"
      aria-modal="true"
      aria-label={call.type === "video" ? "Video call" : "Audio call"}
      data-testid="call-surface"
      data-call-status={call.status}
      data-call-type={call.type}
      data-call-role={call.role}
      className={cn(
        "fixed inset-0 z-[90] flex flex-col",
        video
          ? "bg-[var(--shhh-viewer-ink)]"
          : "bg-background pt-[var(--shhh-safe-top)] pb-[var(--shhh-safe-bottom)]",
      )}
      style={
        video
          ? undefined
          : { background: "var(--shhh-bg)" }
      }
    >
      <audio ref={media.bindRemoteAudio} autoPlay className="hidden" />
      <button
        type="button"
        aria-label="Minimize call"
        data-testid="minimize-call"
        onClick={() => session.setMinimized(true)}
        className={cn(
          "shhh-press absolute start-3 z-20 inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]",
          video
            ? "bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)]"
            : "bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)]",
        )}
        style={{ top: "calc(0.75rem + var(--shhh-safe-top))" }}
      >
        <ChevronDown className="size-5" strokeWidth={2.2} />
      </button>
      {incoming ? (
        <IncomingCall
          partnerName={partnerName}
          type={call.type}
          onAccept={() => void session.accept()}
          onDecline={() => void session.decline()}
        />
      ) : outgoing ? (
        <OutgoingCall
          partnerName={partnerName}
          type={call.type}
          onCancel={() => void session.cancel()}
        />
      ) : call.type === "video" ? (
        <VideoCallSurface
          partnerName={partnerName}
          selfName={selfName}
          statusLabel={statusLabel(call.status, "video", network === "reconnecting")}
          duration={durationLabel}
          muted={muted}
          cameraOn={cameraOn}
          network={network}
          videoPaused={media.qualityStep === "paused"}
          connecting={call.status === "connecting"}
          failed={failed}
          permissionTitle={permissionCopy?.title ?? error}
          permissionBody={permissionCopy?.body ?? null}
          continueWithoutVideo={continueWithoutVideo}
          autoplayBlocked={autoplayBlocked}
          bindRemoteVideo={media.bindRemoteVideo}
          bindLocalVideo={media.bindLocalVideo}
          chromeVisible={chromeVisible}
          onToggleChrome={() => setChromeVisible((value) => !value)}
          onMute={session.toggleMuted}
          onCamera={session.toggleCamera}
          onSwitchCamera={session.switchCamera}
          onEnd={() => void session.end()}
          onStartAudio={session.startAudio}
          onContinueWithoutVideo={session.continueAudioOnly}
          upgradeNote={
            session.showVideoUpgradeNote ? `${partnerName} turned on video` : null
          }
        />
      ) : (
        <AudioCallSurface
          partnerName={partnerName}
          statusLabel={statusLabel(call.status, "audio", network === "reconnecting")}
          duration={durationLabel}
          muted={muted}
          network={network}
          ringing={call.status === "connecting"}
          failed={failed}
          permissionTitle={permissionCopy?.title ?? error}
          permissionBody={permissionCopy?.body ?? null}
          autoplayBlocked={autoplayBlocked}
          canSpeaker={session.canSpeaker}
          speakerOn={session.speakerOn}
          canUpgrade={call.status === "connected" || call.status === "reconnecting"}
          onMute={session.toggleMuted}
          onSpeaker={session.toggleSpeaker}
          onUpgrade={() => void session.upgradeToVideo()}
          onEnd={() => void session.end()}
          onStartAudio={session.startAudio}
        />
      )}
    </div>,
    document.body,
  );
}
