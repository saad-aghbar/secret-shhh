"use client";

import { CallIdentity } from "@/features/calls/call-identity";
import { ConnectedCallControls, EndCallButton } from "@/features/calls/call-controls";
import type { CallNetworkStatus } from "@/lib/calls/config";
import { qualityCopy } from "@/lib/calls/quality";

export function AudioCallSurface(props: {
  partnerName: string;
  statusLabel: string;
  duration: string | null;
  muted: boolean;
  network: CallNetworkStatus;
  ringing?: boolean;
  failed?: boolean;
  permissionTitle?: string | null;
  permissionBody?: string | null;
  autoplayBlocked?: boolean;
  canSpeaker?: boolean;
  speakerOn?: boolean;
  canUpgrade?: boolean;
  onMute: () => void;
  onSpeaker?: () => void;
  onUpgrade?: () => void;
  onEnd: () => void;
  onStartAudio?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between py-10" data-testid="audio-call">
      <CallIdentity
        name={props.partnerName}
        status={props.permissionTitle ?? props.statusLabel}
        duration={props.failed || props.permissionTitle ? null : props.duration}
        breathing={props.ringing}
      />
      {props.permissionBody ? (
        <p className="max-w-xs text-center text-sm text-secondary-text">{props.permissionBody}</p>
      ) : null}
      {props.network !== "good" && !props.failed ? (
        <p className="text-center text-sm text-secondary-text" aria-live="polite">
          {qualityCopy(props.network, false)}
        </p>
      ) : null}
      {props.autoplayBlocked ? (
        <button
          type="button"
          className="text-accent text-sm font-semibold underline-offset-2 hover:underline"
          onClick={props.onStartAudio}
        >
          Tap to hear
        </button>
      ) : null}
      {props.failed || props.permissionTitle ? (
        <EndCallButton label="Close call" testId="close-failed-call" onClick={props.onEnd} />
      ) : (
        <ConnectedCallControls
          type="audio"
          muted={props.muted}
          cameraOn={false}
          canSpeaker={props.canSpeaker}
          speakerOn={props.speakerOn}
          canUpgrade={props.canUpgrade}
          onMute={props.onMute}
          onSpeaker={props.onSpeaker}
          onUpgrade={props.onUpgrade}
          onEnd={props.onEnd}
        />
      )}
    </div>
  );
}
