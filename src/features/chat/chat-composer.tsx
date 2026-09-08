"use client";

import { ArrowUp, Mic, Plus, Sticker } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { SoftBoundary } from "@/components/shhh/soft-boundary";
import { ShhhIconButton } from "@/components/shhh";
import { ComposerContextHeader } from "@/features/chat/composer-context-header";
import { MediaAttachSheet } from "@/features/chat/media-attach-sheet";
import { PhotoSelectionPreview } from "@/features/chat/photo-selection-preview";
import type { CameraFacing } from "@/features/chat/shhh-camera";
import { VideoSelectionPreview } from "@/features/chat/video-selection-preview";
import { VoiceComposer } from "@/features/chat/voice-composer";
import { useCallSessionOptional } from "@/features/calls/call-session-provider";
import { ChatMusicPicker } from "@/features/music/chat-music-picker";
import { StickerTray } from "@/features/stickers/sticker-tray";
import type { ReplyPreview, StickerRef } from "@/lib/chat/types";
import { isLiveCallStatus } from "@/lib/calls/config";
import { isShhhCameraSupported } from "@/lib/media/camera-recorder";
import { deviceOwner } from "@/lib/media/device-owner";
import { isVoiceRecordingSupported, type VoiceRecordingResult } from "@/lib/media/voice-recorder";
import { extractSupportedMusicUrl } from "@/lib/music/providers/urls";
import {
  remainingSelectionNote,
  splitMediaSelection,
  type MediaOrigin,
  type MediaSelection,
} from "@/features/chat/media-selection";
import { cn } from "@/lib/utils";
import { messageTextMaxLength } from "@/lib/validation/chat";

const ShhhCamera = dynamic(
  () => import("@/features/chat/shhh-camera").then((mod) => mod.ShhhCamera),
  { ssr: false },
);

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onSendPhotos?: (files: File[], caption: string) => void;
  onSendVideo?: (file: File, caption: string, origin?: MediaOrigin) => void;
  onSendVoice?: (recording: VoiceRecordingResult) => void;
  onSendSticker?: (sticker: StickerRef) => void;
  onOpenDoodle?: () => void;
  partnerName?: string;
  userId?: string;
  onTyping?: (active: boolean) => void;
  disabled?: boolean;
  context?: { mode: "reply"; senderName: string; preview: ReplyPreview } | { mode: "edit" } | null;
  onCancelContext?: () => void;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  onSendPhotos,
  onSendVideo,
  onSendVoice,
  onSendSticker,
  onOpenDoodle,
  partnerName = "Them",
  userId = "",
  onTyping,
  disabled,
  context = null,
  onCancelContext,
}: ChatComposerProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLButtonElement>(null);
  const stickerRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicPasteUrl, setMusicPasteUrl] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [retaking, setRetaking] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [queue, setQueue] = useState<MediaSelection[]>([]);
  const max = messageTextMaxLength();
  const hasText = value.replace(/^\s+|\s+$/gu, "").length > 0;
  const editing = context?.mode === "edit";
  const canSend = hasText && !disabled;

  useLayoutEffect(() => {
    const sync = () => {
      setCameraSupported(isShhhCameraSupported());
      setVoiceSupported(isVoiceRecordingSupported());
    };
    sync();
  }, []);

  useEffect(() => {
    void import("@/features/chat/shhh-camera");
    void import("@/features/stickers/sticker-creator");
  }, []);

  const closeVoice = useCallback(() => setRecordingVoice(false), []);
  const callSession = useCallSessionOptional();
  const liveCall = Boolean(callSession?.call && isLiveCallStatus(callSession.call.status));

  /* eslint-disable react-hooks/set-state-in-effect -- a live call must drop recorder/camera ownership */
  useEffect(() => {
    if (!liveCall) return;
    setRecordingVoice(false);
    setCameraOpen(false);
  }, [liveCall]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return deviceOwner.subscribe((owner) => {
      if (owner !== "call") return;
      setRecordingVoice(false);
      setCameraOpen(false);
    });
  }, []);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 128)}px`;
  }, [value]);

  const enqueueFiles = useCallback((files: File[], origin: MediaOrigin, replaceHead = false) => {
    const items = splitMediaSelection(files, origin);
    if (!items.length) return;
    setQueue((current) => (replaceHead ? [...items, ...current.slice(1)] : [...current, ...items]));
  }, []);

  function submit() {
    if (!canSend) {
      return;
    }
    onTyping?.(false);
    onSend(value);
  }

  const current = queue[0];
  const remainingNote = remainingSelectionNote(Math.max(0, queue.length - 1));
  const camera = cameraOpen ? (
    <SoftBoundary>
      <ShhhCamera
        initialFacing={cameraFacing}
        onFacingChange={setCameraFacing}
        onClose={() => {
          setCameraOpen(false);
          setRetaking(false);
        }}
        onCapture={(files) => {
          enqueueFiles(files, "camera", retaking);
          setRetaking(false);
          setCameraOpen(false);
        }}
      />
    </SoftBoundary>
  ) : null;

  if (recordingVoice && onSendVoice && !editing) {
    return (
      <VoiceComposer
        disabled={disabled}
        onClose={closeVoice}
        onSend={(recording) => onSendVoice(recording)}
      />
    );
  }

  if (current?.kind === "video") {
    return (
      <div className="animate-shhh-settle motion-reduce:animate-none">
        <VideoSelectionPreview
          file={current.file}
          note={remainingNote}
          onCancel={() => setQueue((items) => items.slice(1))}
          onRetake={
            current.origin === "camera"
              ? () => {
                  setRetaking(true);
                  setCameraOpen(true);
                }
              : undefined
          }
          disabled={disabled}
          onSend={(file, caption) => {
            onSendVideo?.(file, caption, current.origin);
            setQueue((items) => items.slice(1));
          }}
        />
        {camera}
      </div>
    );
  }

  if (current?.kind === "photos") {
    return (
      <div className="animate-shhh-settle motion-reduce:animate-none">
        <PhotoSelectionPreview
          files={current.files}
          note={remainingNote}
          onChange={(files) => {
            if (!files.length) {
              setQueue((items) => items.slice(1));
              return;
            }
            setQueue((items) => [
              { kind: "photos", files, origin: current.origin },
              ...items.slice(1),
            ]);
          }}
          onCancel={() => setQueue((items) => items.slice(1))}
          onRetake={
            current.origin === "camera"
              ? () => {
                  setRetaking(true);
                  setCameraOpen(true);
                }
              : undefined
          }
          disabled={disabled}
          onSend={(files, caption) => {
            onSendPhotos?.(files, caption);
            setQueue((items) => items.slice(1));
          }}
        />
        {camera}
      </div>
    );
  }

  return (
    <>
      {context ? (
        context.mode === "reply" ? (
          <ComposerContextHeader
            mode="reply"
            senderName={context.senderName}
            preview={context.preview}
            onClose={() => onCancelContext?.()}
          />
        ) : (
          <ComposerContextHeader mode="edit" onClose={() => onCancelContext?.()} />
        )
      ) : null}
      {musicPasteUrl && !editing ? (
        <div
          className="mx-3 mb-1 flex flex-wrap items-center gap-2 rounded-[1.35rem] bg-surface-elevated/95 px-3 py-2 shadow-[var(--shhh-shadow-soft)]"
          data-testid="send-as-music"
        >
          <p className="text-primary-text min-w-0 flex-1 text-sm font-medium">Send as music?</p>
          <button
            type="button"
            className="text-accent min-h-11 px-2 text-sm font-semibold"
            data-testid="send-as-music-card"
            onClick={() => {
              setMusicOpen(true);
            }}
          >
            Music card
          </button>
          <button
            type="button"
            className="text-secondary-text min-h-11 px-2 text-sm font-semibold"
            data-testid="send-as-music-link"
            onClick={() => setMusicPasteUrl(null)}
          >
            Send as link
          </button>
        </div>
      ) : null}
      <form
        className="bg-transparent px-3 pt-1 pb-1"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="bg-composer flex items-end gap-2 rounded-[1.75rem] px-2 py-2 shadow-[var(--shhh-shadow-float)]">
          {editing ? null : (
            <ShhhIconButton
              ref={attachRef}
              type="button"
              label="Add"
              data-testid="photo-attach"
              disabled={disabled || !onSendPhotos}
              className={cn(
                "shhh-press bg-bg-soft text-secondary-text hover:text-primary-text size-11 shrink-0",
                pickerOpen && "bg-accent-soft text-accent-strong rotate-45",
              )}
              onClick={() => setPickerOpen(true)}
            >
              <Plus
                className={cn(
                  "size-5 transition-transform duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)] motion-reduce:transition-none",
                  pickerOpen && "rotate-45",
                )}
                strokeWidth={2.3}
              />
            </ShhhIconButton>
          )}
          <label className="sr-only" htmlFor="shhh-message">
            Message
          </label>
          <textarea
            id="shhh-message"
            ref={areaRef}
            dir="auto"
            rows={1}
            value={value}
            placeholder="Message…"
            maxLength={max * 4}
            onChange={(event) => {
              onChange(event.target.value);
              onTyping?.(event.target.value.trim().length > 0);
            }}
            onBlur={() => onTyping?.(false)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              const parsed = pasted ? extractSupportedMusicUrl(pasted) : null;
              if (!parsed || editing) return;
              const trimmed = pasted.trim();
              if (trimmed !== parsed.canonicalUrl && !trimmed.startsWith("http")) return;
              setMusicPasteUrl(parsed.canonicalUrl);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className={cn(
              "font-message max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5",
              "text-primary-text text-start text-base leading-relaxed outline-none",
              "placeholder:text-muted-text [unicode-bidi:plaintext]",
            )}
          />
          {!hasText && !editing && onSendSticker ? (
            <ShhhIconButton
              ref={stickerRef}
              type="button"
              label="Stickers"
              data-testid="sticker-open"
              disabled={disabled}
              className={cn(
                "shhh-press bg-bg-soft text-secondary-text hover:text-primary-text size-11 shrink-0",
                stickerOpen && "bg-accent-soft text-accent-strong",
              )}
              onClick={() => setStickerOpen(true)}
            >
              <Sticker className="size-5" strokeWidth={2.2} />
            </ShhhIconButton>
          ) : null}
          {/* The trailing control is the message: words send, silence records. */}
          {!hasText && !editing && voiceSupported && onSendVoice ? (
            <ShhhIconButton
              type="button"
              label="Record a voice message"
              data-testid="voice-start"
              disabled={disabled}
              className="shhh-press bg-bg-soft text-secondary-text hover:bg-accent-soft hover:text-accent-strong size-11 shrink-0"
              onClick={() => {
                onTyping?.(false);
                setRecordingVoice(true);
              }}
            >
              <Mic className="size-5" strokeWidth={2.2} />
            </ShhhIconButton>
          ) : (
            <ShhhIconButton
              type="submit"
              label={editing ? "Save" : "Send"}
              disabled={!canSend}
              className={cn(
                "shhh-press size-11 shrink-0 transition-[background-color,color,box-shadow,transform] duration-[var(--shhh-motion-normal)] ease-[var(--shhh-ease-settle)]",
                canSend
                  ? "bg-button hover:bg-button-strong text-on-button"
                  : "bg-bg-soft text-muted-text shadow-none",
              )}
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </ShhhIconButton>
          )}
        </div>
      </form>
      <MediaAttachSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectFiles={(files) => enqueueFiles(files, "library")}
        onOpenCamera={() => setCameraOpen(true)}
        onOpenDoodle={
          onOpenDoodle
            ? () => {
                setPickerOpen(false);
                setStickerOpen(false);
                setRecordingVoice(false);
                setCameraOpen(false);
                onOpenDoodle();
              }
            : undefined
        }
        onOpenMusic={() => {
          setPickerOpen(false);
          setStickerOpen(false);
          setRecordingVoice(false);
          setCameraOpen(false);
          setMusicPasteUrl(null);
          setMusicOpen(true);
        }}
        cameraSupported={cameraSupported}
        anchorRef={attachRef}
      />
      <ChatMusicPicker
        open={musicOpen}
        onClose={() => {
          setMusicOpen(false);
          setMusicPasteUrl(null);
        }}
        partnerName={partnerName}
        initialUrl={musicPasteUrl ?? undefined}
      />
      {onSendSticker ? (
        <StickerTray
          open={stickerOpen}
          onClose={() => setStickerOpen(false)}
          onSend={(sticker) => onSendSticker(sticker)}
          partnerName={partnerName}
          userId={userId}
          anchorRef={stickerRef}
        />
      ) : null}
      {camera}
    </>
  );
}
