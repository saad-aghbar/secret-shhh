"use client";

import { Maximize2, Minimize2, PictureInPicture2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CallIdentity } from "@/features/calls/call-identity";
import { ConnectedCallControls, EndCallButton } from "@/features/calls/call-controls";
import { LocalPreview } from "@/features/calls/local-preview";
import type { CallNetworkStatus } from "@/lib/calls/config";
import { qualityCopy } from "@/lib/calls/quality";
import { cn } from "@/lib/utils";

export function VideoCallSurface(props: {
  partnerName: string;
  selfName: string;
  statusLabel: string;
  duration: string | null;
  muted: boolean;
  cameraOn: boolean;
  network: CallNetworkStatus;
  videoPaused: boolean;
  connecting?: boolean;
  failed?: boolean;
  permissionTitle?: string | null;
  permissionBody?: string | null;
  continueWithoutVideo?: boolean;
  autoplayBlocked?: boolean;
  bindRemoteVideo: (element: HTMLVideoElement | null) => void;
  bindLocalVideo: (element: HTMLVideoElement | null) => void;
  chromeVisible: boolean;
  onToggleChrome: () => void;
  onMute: () => void;
  onCamera: () => void;
  onSwitchCamera: () => void;
  onEnd: () => void;
  onStartAudio?: () => void;
  onContinueWithoutVideo?: () => void;
  upgradeNote?: string | null;
}) {
  const remoteVideoNode = useRef<HTMLVideoElement | null>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [canPip, setCanPip] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- feature-detect once on mount */
  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    setCanPip("pictureInPictureEnabled" in document);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function toggleFullscreen() {
    const node = document.getElementById("shhh-call-surface");
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
      return;
    }
    await node.requestFullscreen().catch(() => undefined);
    setFullscreen(Boolean(document.fullscreenElement));
  }

  async function togglePip() {
    const video = remoteVideoNode.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => undefined);
      return;
    }
    await video.requestPictureInPicture().catch(() => undefined);
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="video-call"
      onClick={props.onToggleChrome}
    >
      <div className="absolute inset-0 grid place-items-center">
        <CallIdentity name={props.partnerName} status="" ink avatarOnly />
      </div>
      <video
        ref={(element) => {
          remoteVideoNode.current = element;
          props.bindRemoteVideo(element);
        }}
        autoPlay
        playsInline
        className="absolute inset-0 size-full object-cover"
        data-testid="remote-video"
      />
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_38%,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[var(--shhh-viewer-ink)] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--shhh-viewer-ink)] to-transparent" />

      {props.connecting || props.failed || props.permissionTitle ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
          <CallIdentity
            name={props.partnerName}
            status={props.permissionTitle ?? props.statusLabel}
            ink
          />
          {props.permissionBody ? (
            <p className="mt-3 max-w-xs text-center text-sm text-[rgb(247_241_232_/0.78)]">
              {props.permissionBody}
            </p>
          ) : null}
          {props.onContinueWithoutVideo && props.permissionTitle ? (
            <button
              type="button"
              className="mt-4 rounded-full bg-[rgb(247_241_232_/0.16)] px-4 py-2 text-sm font-semibold text-[var(--shhh-viewer-ivory)]"
              onClick={(event) => {
                event.stopPropagation();
                props.onContinueWithoutVideo?.();
              }}
            >
              Continue without video
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "relative z-10 flex flex-1 flex-col items-center px-4 pt-[calc(1.25rem+var(--shhh-safe-top))]",
            !props.chromeVisible && "opacity-0",
          )}
        >
          <p className="max-w-[18rem] truncate text-lg font-semibold text-[var(--shhh-viewer-ivory)]">
            {props.partnerName}
          </p>
          <p className="text-sm text-[rgb(247_241_232_/0.78)]">
            {props.statusLabel}
          </p>
          {props.duration ? (
            <p className="text-sm tabular-nums text-[rgb(247_241_232_/0.7)]" aria-hidden>
              {props.duration}
            </p>
          ) : null}
        </div>
      )}

      <LocalPreview
        bindVideo={props.bindLocalVideo}
        cameraOn={props.cameraOn && !props.continueWithoutVideo}
        selfName={props.selfName}
      />

      {props.upgradeNote ? (
        <p
          className="absolute inset-x-4 top-[calc(4.5rem+var(--shhh-safe-top))] z-10 rounded-full bg-[rgb(20_16_14_/0.45)] px-3 py-2 text-center text-xs text-[var(--shhh-viewer-ivory)]"
          data-testid="video-upgrade-note"
        >
          {props.upgradeNote}
        </p>
      ) : props.network !== "good" || props.videoPaused ? (
        <p className="absolute inset-x-4 top-[calc(4.5rem+var(--shhh-safe-top))] z-10 rounded-full bg-[rgb(20_16_14_/0.45)] px-3 py-2 text-center text-xs text-[var(--shhh-viewer-ivory)]">
          {qualityCopy(props.network, props.videoPaused)}
        </p>
      ) : null}

      {props.autoplayBlocked ? (
        <button
          type="button"
          className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm font-semibold text-[var(--shhh-viewer-ivory)]"
          onClick={(event) => {
            event.stopPropagation();
            props.onStartAudio?.();
          }}
        >
          Tap to hear
        </button>
      ) : null}

      <div
        className={cn(
          "relative z-10 mt-auto flex flex-col items-center gap-3 pb-[calc(1.25rem+var(--shhh-safe-bottom))]",
          !props.chromeVisible && "opacity-100",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {canFullscreen ? (
            <button
              type="button"
              aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
              className="inline-flex size-11 items-center justify-center rounded-full bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)]"
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          ) : null}
          {canPip ? (
            <button
              type="button"
              aria-label="Enter picture in picture"
              className="inline-flex size-11 items-center justify-center rounded-full bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)]"
              onClick={() => void togglePip()}
            >
              <PictureInPicture2 className="size-4" />
            </button>
          ) : null}
        </div>
        {props.failed ? (
          <EndCallButton label="Close call" testId="close-failed-call" onClick={props.onEnd} />
        ) : (
          <ConnectedCallControls
            type="video"
            muted={props.muted}
            cameraOn={props.cameraOn && !props.continueWithoutVideo}
            ink
            canSwitchCamera
            onMute={props.onMute}
            onCamera={props.onCamera}
            onSwitchCamera={props.onSwitchCamera}
            onEnd={props.onEnd}
          />
        )}
      </div>
    </div>
  );
}
