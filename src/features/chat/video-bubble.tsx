"use client";

import { Play, X } from "lucide-react";
import { useRef, useState } from "react";

import { ShhhButton, ShhhModal } from "@/components/shhh";
import { openChatMediaViewer } from "@/features/chat/chat-media-viewer";
import { ProgressiveImage } from "@/features/chat/progressive-image";
import { VideoStillPlaceholder } from "@/features/chat/video-placeholder";
import type { BubbleGroup, ChatMediaItem, MessageSendStatus } from "@/lib/chat/types";
import { formatDurationMs } from "@/lib/media/duration";
import { uploadManager } from "@/lib/uploads/manager";
import { cn } from "@/lib/utils";

type VideoBubbleProps = {
  media: ChatMediaItem;
  caption?: string;
  progress?: number;
  isOwn?: boolean;
  group?: BubbleGroup;
  senderName: string;
  clientGeneratedId?: string;
  needsReselect?: boolean;
  origin?: "library" | "camera";
  sendStatus?: MessageSendStatus;
};

function veilLabel(progress: number, status?: MessageSendStatus) {
  if (status === "queued") return "Waiting for connection";
  if (status === "preparing" || progress < 2) return "Preparing video…";
  if (progress >= 99) return "Finishing…";
  return `Uploading ${Math.round(progress)}%`;
}

function outerRadius(isOwn: boolean, group: BubbleGroup) {
  if (isOwn) {
    if (group === "first") return "rounded-[1.55rem_1.55rem_0.55rem_1.55rem]";
    if (group === "middle") return "rounded-[1.55rem_0.55rem_0.55rem_1.55rem]";
    if (group === "last") return "rounded-[1.55rem_0.55rem_0.55rem_1.55rem]";
    return "rounded-[1.55rem_1.5rem_0.5rem_1.55rem]";
  }
  if (group === "first") return "rounded-[1.55rem_1.55rem_1.55rem_0.55rem]";
  if (group === "middle") return "rounded-[0.55rem_1.55rem_1.55rem_0.55rem]";
  if (group === "last") return "rounded-[0.55rem_1.55rem_1.55rem_0.55rem]";
  return "rounded-[1.55rem_1.55rem_1.55rem_0.5rem]";
}

function frameAspect(width?: number | null, height?: number | null) {
  const w = width && width > 0 ? width : 16;
  const h = height && height > 0 ? height : 9;
  return Math.min(1.6, Math.max(0.72, w / h));
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (clamped / 100) * circ;
  return (
    <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="color-mix(in srgb, var(--shhh-bg) 35%, transparent)"
        strokeWidth="3.5"
      />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="var(--shhh-accent)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function VideoBubble({
  media,
  caption,
  progress,
  isOwn,
  group = "single",
  senderName,
  clientGeneratedId,
  needsReselect,
  origin,
  sendStatus,
}: VideoBubbleProps) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const reselectRef = useRef<HTMLInputElement>(null);
  const uploading =
    sendStatus !== "failed" && typeof progress === "number" && progress >= 0 && progress < 100;
  const aspect = frameAspect(media.width, media.height);
  const duration = formatDurationMs(media.durationMs);
  const alt = `Video sent by ${senderName}`;
  const hasPoster = Boolean(
    media.hasPreview || media.hasThumbnail || media.localThumbUrl || media.localObjectUrl,
  );

  return (
    <>
      <div
        data-testid="video-bubble"
        data-poster={hasPoster ? "ready" : "placeholder"}
        data-side={isOwn ? "outgoing" : "incoming"}
        className={cn(
          "relative overflow-hidden shadow-[var(--shhh-shadow-soft)]",
          "w-[min(78vw,18.5rem)]",
          isOwn
            ? "bg-[color-mix(in_srgb,var(--shhh-outgoing)_88%,var(--shhh-surface-elevated))]"
            : "bg-[color-mix(in_srgb,var(--shhh-incoming)_92%,var(--shhh-surface-elevated))]",
          outerRadius(Boolean(isOwn), group),
        )}
      >
        <button
          type="button"
          aria-label="Open video"
          className="bg-bg-soft focus-visible:ring-accent relative w-full overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
          style={{ aspectRatio: String(aspect), maxHeight: "min(58vh, 22rem)" }}
          onClick={() => {
            if (uploading || needsReselect) return;
            openChatMediaViewer({
              media: [media],
              initialIndex: 0,
              senderName,
              caption,
            });
          }}
        >
          {hasPoster ? (
            <ProgressiveImage media={media} alt={alt} fit="cover" className="absolute inset-0" />
          ) : (
            <VideoStillPlaceholder />
          )}
          {!uploading ? (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_46%,transparent)] text-[var(--shhh-viewer-ivory)] shadow-[var(--shhh-shadow-soft)] backdrop-blur-sm">
                <Play className="ms-0.5 size-6" fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          ) : null}
          {duration ? (
            <span className="absolute end-2.5 bottom-2.5 rounded-full bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_55%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--shhh-viewer-ivory)] backdrop-blur-sm">
              {duration}
            </span>
          ) : null}
        </button>
        {caption ? (
          <p
            dir="auto"
            className="font-message text-primary-text px-3.5 py-2.5 text-start text-[15px] leading-relaxed [unicode-bidi:plaintext]"
          >
            {caption}
          </p>
        ) : null}
        {uploading ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--shhh-bg)_28%,transparent)]"
            aria-label={`Uploading ${Math.round(progress)}%`}
            data-testid="video-upload-veil"
          >
            <div className="flex flex-col items-center gap-1.5 rounded-[1.25rem] bg-[color-mix(in_srgb,var(--shhh-surface-floating)_82%,transparent)] px-4 py-3 shadow-[var(--shhh-shadow-soft)] backdrop-blur-sm">
              <ProgressRing value={progress} />
              <span className="text-muted-text text-[11px] font-medium">
                {veilLabel(progress ?? 0, sendStatus)}
              </span>
            </div>
            {clientGeneratedId ? (
              <button
                type="button"
                data-testid="video-upload-cancel"
                data-message-gesture-ignore
                aria-label="Stop sending this video"
                className="shhh-press absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--shhh-text)_55%,transparent)] text-[var(--shhh-bg)] backdrop-blur-sm"
                onClick={() => setConfirmCancel(true)}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {needsReselect && clientGeneratedId ? (
          origin === "camera" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--shhh-bg)_38%,transparent)] px-4">
              <div
                data-testid="video-camera-gone"
                className="flex max-w-[16rem] flex-col items-center gap-3 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--shhh-surface-floating)_88%,transparent)] px-4 py-3 text-center shadow-[var(--shhh-shadow-soft)] backdrop-blur-sm"
              >
                <p className="text-primary-text text-sm leading-snug font-medium">
                  This clip was recorded in Shhh. After a refresh it can&apos;t be sent again.
                </p>
                <button
                  type="button"
                  data-testid="video-camera-remove"
                  data-message-gesture-ignore
                  className="shhh-press bg-bg-soft text-primary-text rounded-full px-4 py-2 text-sm font-semibold"
                  onClick={() => void uploadManager.cancel(clientGeneratedId)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--shhh-bg)_38%,transparent)] px-4">
              <button
                type="button"
                data-testid="video-reselect"
                data-message-gesture-ignore
                className="shhh-press text-primary-text rounded-[1.2rem] bg-[color-mix(in_srgb,var(--shhh-surface-floating)_88%,transparent)] px-4 py-3 text-center text-sm font-medium shadow-[var(--shhh-shadow-soft)] backdrop-blur-sm"
                onClick={() => reselectRef.current?.click()}
              >
                Choose the video again to continue.
              </button>
              <input
                ref={reselectRef}
                data-testid="video-reselect-input"
                className="sr-only"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadManager.retry(clientGeneratedId, [file]);
                }}
              />
            </div>
          )
        ) : null}
      </div>
      <ShhhModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Stop sending this video?"
        footer={
          <div className="flex gap-2">
            <ShhhButton variant="ghost" className="flex-1" onClick={() => setConfirmCancel(false)}>
              Keep sending
            </ShhhButton>
            <ShhhButton
              variant="primary"
              className="flex-[1.2]"
              data-testid="video-cancel-confirm"
              onClick={() => {
                setConfirmCancel(false);
                if (clientGeneratedId) void uploadManager.cancel(clientGeneratedId);
              }}
            >
              Stop sending
            </ShhhButton>
          </div>
        }
      >
        <p className="text-secondary-text text-sm leading-relaxed">
          The clip won’t be sent. You can choose it again later.
        </p>
      </ShhhModal>
    </>
  );
}
