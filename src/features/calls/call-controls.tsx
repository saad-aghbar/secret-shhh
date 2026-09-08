"use client";

import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const toggleClass =
  "shhh-press inline-flex size-12 items-center justify-center rounded-full bg-surface-elevated text-primary-text shadow-[var(--shhh-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)] disabled:opacity-50";

const inkToggle =
  "bg-[rgb(247_241_232_/0.16)] text-[var(--shhh-viewer-ivory)] shadow-none hover:bg-[rgb(247_241_232_/0.24)]";

export function CallToggleButton(props: {
  label: string;
  pressed?: boolean;
  ink?: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.pressed}
      data-testid={props.testId}
      onClick={props.onClick}
      className={cn(toggleClass, props.ink && inkToggle, props.pressed && "bg-accent text-on-accent")}
    >
      {props.children}
    </button>
  );
}

export function EndCallButton(props: { onClick: () => void; label?: string; testId?: string }) {
  return (
    <button
      type="button"
      aria-label={props.label ?? "End call"}
      data-testid={props.testId ?? "end-call"}
      onClick={props.onClick}
      className="shhh-press inline-flex size-16 items-center justify-center rounded-full bg-[var(--shhh-danger)] text-white shadow-[var(--shhh-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
    >
      <PhoneOff className="size-7" strokeWidth={2.1} />
    </button>
  );
}

export function ConnectedCallControls(props: {
  type: "audio" | "video";
  muted: boolean;
  cameraOn: boolean;
  ink?: boolean;
  canSwitchCamera?: boolean;
  canSpeaker?: boolean;
  speakerOn?: boolean;
  canUpgrade?: boolean;
  onMute: () => void;
  onCamera?: () => void;
  onSwitchCamera?: () => void;
  onSpeaker?: () => void;
  onUpgrade?: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-full px-3 py-2",
        props.ink
          ? "bg-[rgb(247_241_232_/0.12)] backdrop-blur-md"
          : "bg-surface-elevated/90 shadow-[var(--shhh-shadow-float)] backdrop-blur-md",
      )}
      data-testid="call-controls"
    >
      <CallToggleButton
        label={props.muted ? "Unmute microphone" : "Mute microphone"}
        pressed={props.muted}
        ink={props.ink}
        testId="call-mute"
        onClick={props.onMute}
      >
        {props.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </CallToggleButton>
      {props.type === "video" ? (
        <CallToggleButton
          label={props.cameraOn ? "Turn camera off" : "Turn camera on"}
          pressed={!props.cameraOn}
          ink={props.ink}
          testId="call-camera"
          onClick={() => props.onCamera?.()}
        >
          {props.cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </CallToggleButton>
      ) : null}
      {props.type === "video" && props.canSwitchCamera ? (
        <CallToggleButton
          label="Switch camera"
          ink={props.ink}
          testId="call-switch-camera"
          onClick={() => props.onSwitchCamera?.()}
        >
          <SwitchCamera className="size-5" />
        </CallToggleButton>
      ) : null}
      {props.canUpgrade ? (
        <CallToggleButton
          label="Turn into video call"
          ink={props.ink}
          testId="call-upgrade-video"
          onClick={() => props.onUpgrade?.()}
        >
          <Video className="size-5" />
        </CallToggleButton>
      ) : null}
      {props.canSpeaker ? (
        <CallToggleButton
          label={props.speakerOn ? "Use earpiece" : "Speaker"}
          pressed={props.speakerOn}
          ink={props.ink}
          testId="call-speaker"
          onClick={() => props.onSpeaker?.()}
        >
          <Volume2 className="size-5" />
        </CallToggleButton>
      ) : null}
      <EndCallButton onClick={props.onEnd} />
    </div>
  );
}

export function IncomingCallControls(props: {
  onDecline: () => void;
  onAccept: () => void;
  video?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-10" data-testid="incoming-call-controls">
      <button
        type="button"
        aria-label="Decline call"
        data-testid="decline-call"
        onClick={props.onDecline}
        className="shhh-press inline-flex size-16 flex-col items-center justify-center rounded-full bg-[var(--shhh-danger)] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
      >
        <PhoneOff className="size-7" strokeWidth={2.1} />
      </button>
      <button
        type="button"
        aria-label={props.video ? "Answer video call" : "Answer audio call"}
        data-testid="accept-call"
        onClick={props.onAccept}
        className="shhh-press inline-flex size-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-[var(--shhh-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-focus-ring)]"
      >
        {props.video ? (
          <Video className="size-7" strokeWidth={2.1} />
        ) : (
          <Phone className="size-7" strokeWidth={2.1} />
        )}
      </button>
    </div>
  );
}
