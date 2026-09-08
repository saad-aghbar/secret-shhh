"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ShhhBubble, ShhhIconButton } from "@/components/shhh";
import type { PopoverAnchor } from "@/components/shhh/shhh-popover";
import { CallEventRow } from "@/features/calls/call-event-row";
import { ChatMessageBody } from "@/features/chat/chat-message-body";
import { DeleteMessageConfirm } from "@/features/chat/delete-message-confirm";
import { MessageActionsMenu, type MessageActionId } from "@/features/chat/message-actions-menu";
import { MessageTombstone } from "@/features/chat/message-tombstone";
import { PhotoBubble } from "@/features/chat/photo-bubble";
import { ReactionSummary } from "@/features/chat/reaction-summary";
import { ReplyPreviewStrip } from "@/features/chat/reply-preview-strip";
import { SwipeToReply } from "@/features/chat/swipe-to-reply";
import { VideoBubble } from "@/features/chat/video-bubble";
import { DoodleBubble } from "@/features/doodles/doodle-bubble";
import { MusicBubble } from "@/features/music/music-bubble";
import { useMusicPlayerOptional } from "@/features/music/music-player-provider";
import { StickerBubble } from "@/features/chat/sticker-bubble";
import { VoiceBubble } from "@/features/chat/voice-bubble";
import { StickerRenameDialog } from "@/features/stickers/sticker-rename-dialog";
import { formatMessageTime } from "@/lib/chat/layout";
import { messageActionFlags } from "@/lib/chat/message-actions";
import type { BubbleGroup, ChatMessage, MessageSendStatus } from "@/lib/chat/types";
import { createMessageGesture } from "@/lib/gestures/message-gesture";
import { saveMediaOriginal } from "@/lib/media/save-original";
import { extractSupportedMusicUrl } from "@/lib/music/providers/urls";
import {
  apiAddToPlaylist,
  apiMusicHome,
  apiPatchLibrary,
  apiRecommendTrack,
} from "@/lib/music/client-api";
import { musicKeys } from "@/features/music/query-keys";
import { cn } from "@/lib/utils";

type ChatMessageRowProps = {
  message: ChatMessage;
  group: BubbleGroup;
  showTime: boolean;
  isOwn: boolean;
  senderName: string;
  selfName: string;
  partnerName: string;
  userId: string;
  status: MessageSendStatus;
  highlighted?: boolean;
  onRetry?: () => void;
  onVisible?: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage, emoji: string | null) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onJumpToReply?: (messageId: string) => void;
  onSaveSticker?: (message: ChatMessage) => void;
  onUnsaveSticker?: (message: ChatMessage) => void;
  onRenameSticker?: (message: ChatMessage, name: string | null) => void;
};

function statusLabel(status: MessageSendStatus, isMedia: boolean, uploadError?: string) {
  if (status === "queued") {
    return isMedia ? "Waiting for connection" : "Queued";
  }
  if (status === "sending" || status === "preparing") {
    return "Sending…";
  }
  if (status === "uploading") {
    return "Sending…";
  }
  if (status === "failed") {
    if (isMedia && uploadError?.trim()) {
      return `${uploadError.trim()} · Tap to retry`;
    }
    return isMedia ? "Couldn't send · Tap to retry" : "Tap to retry";
  }
  if (status === "delivered") {
    return "Delivered";
  }
  if (status === "read") {
    return "Read";
  }
  return "Sent";
}

/**
 * Quiet Sent/Delivered/Read only on last/single of an outgoing group.
 * Exceptional Queued/Failed/Sending may show on any bubble.
 */
export function shouldShowMessageMeta(input: {
  isOwn: boolean;
  showTime: boolean;
  status: MessageSendStatus;
}) {
  const exceptional =
    input.status === "failed" ||
    input.status === "queued" ||
    input.status === "sending" ||
    input.status === "preparing" ||
    input.status === "uploading";
  const quietOwn =
    input.isOwn &&
    input.showTime &&
    (input.status === "sent" || input.status === "delivered" || input.status === "read");
  return input.showTime || exceptional || quietOwn;
}

function ignoredTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("[data-message-gesture-ignore]"));
}

/** Quiet LTR metadata — time · status. Independent of Arabic body bidi. */
export function ChatMessageRow(props: ChatMessageRowProps) {
  if (props.message.type === "call") {
    return <CallEventRow message={props.message} />;
  }
  return <ChatMessageBubbleRow {...props} />;
}

function ChatMessageBubbleRow({
  message,
  group,
  showTime,
  isOwn,
  senderName,
  selfName,
  partnerName,
  userId,
  status,
  highlighted = false,
  onRetry,
  onVisible,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onJumpToReply,
  onSaveSticker,
  onUnsaveSticker,
  onRenameSticker,
}: ChatMessageRowProps) {
  const isPhoto = message.type === "image";
  const isVideo = message.type === "video";
  const isVoice = message.type === "audio";
  const isSticker = message.type === "sticker";
  const isDoodle = message.type === "doodle";
  const isMusic = message.type === "music";
  const isMedia = isPhoto || isVideo || isVoice;
  const deleted = Boolean(message.deletedAt);
  const flags = messageActionFlags(message, userId);
  const showMeta =
    !deleted && (Boolean(message.editedAt) || shouldShowMessageMeta({ isOwn, showTime, status }));
  const showOwnStatus =
    isOwn &&
    (status === "failed" ||
      status === "queued" ||
      status === "sending" ||
      status === "preparing" ||
      status === "uploading" ||
      (showTime && (status === "sent" || status === "delivered" || status === "read")));
  const player = useMusicPlayerOptional();
  const queryClient = useQueryClient();
  const musicHome = useQuery({
    queryKey: musicKeys.home(),
    queryFn: apiMusicHome,
    enabled: isMusic && !deleted,
    staleTime: 8_000,
  });
  const musicLink = !deleted && message.type === "text" ? extractSupportedMusicUrl(message.textContent) : null;
  const mine = message.reactions?.find((item) => item.userId === userId)?.emoji ?? null;
  const hasReactions = !deleted && (message.reactions?.length ?? 0) > 0;

  const rootRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef(createMessageGesture());
  const rafRef = useRef(0);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [lifted, setLifted] = useState(false);

  function captureAnchor() {
    const rect =
      bubbleRef.current?.getBoundingClientRect() ?? rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }

  function openMenu() {
    captureAnchor();
    setLifted(true);
    setMenuOpen(true);
    suppressClick.current = true;
  }

  function closeOverlays() {
    setMenuOpen(false);
    setEmojiPickerOpen(false);
    setLifted(false);
    suppressClick.current = false;
  }

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !onVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible(message);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [message, onVisible]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || deleted || ignoredTarget(event.target)) return;
    const gesture = gestureRef.current;
    gesture.reset();
    gesture.pointerDown(event.clientX, event.clientY, performance.now());
    const loop = () => {
      const emitted = gesture.tick(performance.now());
      if (emitted?.type === "longpress") {
        openMenu();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    const emitted = gestureRef.current.pointerMove(event.clientX, event.clientY);
    if (emitted?.type === "swipe-progress") {
      cancelAnimationFrame(rafRef.current);
      setOffset(emitted.offset);
    }
    if (emitted?.type === "cancel") {
      cancelAnimationFrame(rafRef.current);
      setOffset(0);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    cancelAnimationFrame(rafRef.current);
    const emitted = gestureRef.current.pointerUp();
    if (emitted?.type === "swipe-commit" && flags.canReply) {
      suppressClick.current = true;
      onReply?.(message);
    }
    setOffset(0);
  }

  const actions: MessageActionId[] = [
    flags.canReply ? "reply" : null,
    flags.canReact ? "react" : null,
    flags.canEdit ? "edit" : null,
    flags.canSave ? "save" : null,
    flags.canSaveSticker ? "save-sticker" : null,
    flags.canUnsaveSticker ? "unsave-sticker" : null,
    flags.canRenameSticker ? "rename" : null,
    musicLink ? "add-music" : null,
    isMusic && message.music
      ? message.music.savedPersonal
        ? "in-my-music"
        : "save-my-music"
      : null,
    isMusic && message.music
      ? message.music.savedShared
        ? "in-our-music"
        : "save-our-music"
      : null,
    isMusic && message.music ? "add-playlist" : null,
    isMusic && message.music ? "recommend-music" : null,
    isMusic && message.music ? "open-song" : null,
    flags.canDelete ? "delete" : null,
  ].filter((item): item is MessageActionId => Boolean(item));
  const showMore = actions.length > 0 || flags.canReact;

  async function saveMedia() {
    const media = message.media?.[0];
    if (!media) return;
    await saveMediaOriginal({
      mediaId: media.id,
      fallbackFilename: media.originalFilename ?? (isVoice ? "voice" : isVideo ? "video" : "photo"),
      mimeType: media.mimeType,
      shareTitle: isVoice ? "Voice message" : isVideo ? "Video" : "Photo",
      localObjectUrl: media.localObjectUrl,
    }).catch(() => undefined);
  }

  const handleActionRef = useRef<(action: MessageActionId) => void>(() => undefined);

  function handleAction(action: MessageActionId | string) {
    rootRef.current?.setAttribute("data-last-action", action);
    if (action === "delete-now") {
      closeOverlays();
      onDelete?.(message);
      return;
    }
    if (action === "react-clear" || action.startsWith("react:")) {
      closeOverlays();
      onReact?.(message, action === "react-clear" ? null : action.slice("react:".length));
      return;
    }
    if (action === "reply") {
      closeOverlays();
      onReply?.(message);
      return;
    }
    if (action === "react") {
      if (!menuOpen) openMenu();
      return;
    }
    if (action === "react-more") {
      if (!menuOpen) openMenu();
      setEmojiPickerOpen(true);
      return;
    }
    if (action === "edit") {
      closeOverlays();
      onEdit?.(message);
      return;
    }
    if (action === "save") {
      closeOverlays();
      void saveMedia();
      return;
    }
    if (action === "delete") {
      closeOverlays();
      setConfirmOpen(true);
      return;
    }
    if (action === "save-sticker") {
      closeOverlays();
      onSaveSticker?.(message);
      return;
    }
    if (action === "unsave-sticker") {
      closeOverlays();
      onUnsaveSticker?.(message);
      return;
    }
    if (action === "add-music" && musicLink) {
      closeOverlays();
      player?.openAdd(musicLink.canonicalUrl);
      return;
    }
    const trackId = message.music?.trackId;
    if (trackId && (action === "save-my-music" || action === "in-my-music")) {
      closeOverlays();
      void apiPatchLibrary(trackId, "personal", action === "save-my-music").then(() =>
        queryClient.invalidateQueries({ queryKey: musicKeys.all }),
      );
      return;
    }
    if (trackId && (action === "save-our-music" || action === "in-our-music")) {
      closeOverlays();
      void apiPatchLibrary(trackId, "shared", action === "save-our-music").then(() =>
        queryClient.invalidateQueries({ queryKey: musicKeys.all }),
      );
      return;
    }
    if (trackId && action === "add-playlist") {
      closeOverlays();
      const playlistId = musicHome.data?.home.playlists[0]?.id;
      if (playlistId) void apiAddToPlaylist(playlistId, trackId);
      return;
    }
    if (trackId && action === "recommend-music") {
      closeOverlays();
      void apiRecommendTrack(trackId, undefined, crypto.randomUUID());
      return;
    }
    if (action === "open-song") {
      closeOverlays();
      rootRef.current
        ?.querySelector<HTMLButtonElement>('[data-testid="music-bubble-open"]')
        ?.click();
      return;
    }
    if (action === "rename") {
      closeOverlays();
      setRenameOpen(true);
      return;
    }
  }

  useEffect(() => {
    handleActionRef.current = handleAction;
  });

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onCustom = (event: Event) => {
      const action = (event as CustomEvent<MessageActionId>).detail;
      if (action) handleActionRef.current(action);
    };
    node.addEventListener("shhh:message-action", onCustom);
    return () => node.removeEventListener("shhh:message-action", onCustom);
  }, []);

  const body = deleted ? (
    <MessageTombstone isOwn={isOwn} />
  ) : isVoice && message.media?.[0] ? (
    <div
      className={cn(
        "animate-shhh-settle max-w-full min-w-0",
        status === "failed" && "ring-danger/40 rounded-[1.4rem] ring-1",
        highlighted && "shhh-target-highlight",
      )}
    >
      <VoiceBubble
        media={message.media[0]}
        isOwn={isOwn}
        group={group}
        senderName={senderName}
        progress={message.uploadProgress}
        sendStatus={status}
        clientGeneratedId={
          message.id === message.clientGeneratedId ? message.clientGeneratedId : undefined
        }
      />
    </div>
  ) : isVoice ? (
    <ShhhBubble
      side={isOwn ? "outgoing" : "incoming"}
      group={group}
      className="animate-shhh-settle"
    >
      <span data-testid="voice-bubble" data-side={isOwn ? "outgoing" : "incoming"}>
        Voice message
      </span>
    </ShhhBubble>
  ) : isVideo && message.media?.[0] ? (
    <div
      className={cn(
        "animate-shhh-settle",
        status === "failed" && "ring-danger/40 rounded-[1.55rem] ring-1",
        highlighted && "shhh-target-highlight",
      )}
    >
      <VideoBubble
        media={message.media[0]}
        caption={message.textContent}
        progress={message.uploadProgress}
        isOwn={isOwn}
        group={group}
        senderName={senderName}
        clientGeneratedId={
          message.id === message.clientGeneratedId ? message.clientGeneratedId : undefined
        }
        needsReselect={message.media[0].needsReselect}
        origin={message.media[0].origin}
        sendStatus={status}
      />
    </div>
  ) : isSticker ? (
    <div className={cn("animate-shhh-settle", highlighted && "shhh-target-highlight")}>
      <StickerBubble sticker={message.sticker} isOwn={isOwn} />
    </div>
  ) : isDoodle ? (
    <div className={cn("animate-shhh-settle", highlighted && "shhh-target-highlight")}>
      <DoodleBubble
        doodle={message.doodle}
        isOwn={isOwn}
        senderName={senderName}
        timestamp={message.createdAt}
      />
    </div>
  ) : isPhoto && message.media?.length ? (
    <div
      className={cn(
        "animate-shhh-settle",
        status === "failed" && "ring-danger/40 rounded-[1.55rem] ring-1",
        highlighted && "shhh-target-highlight",
      )}
    >
      <PhotoBubble
        media={message.media}
        caption={message.textContent}
        progress={message.uploadProgress}
        isOwn={isOwn}
        group={group}
        senderName={senderName}
      />
    </div>
  ) : isMusic && message.music ? (
    <div className={cn("animate-shhh-settle", highlighted && "shhh-target-highlight")}>
      <MusicBubble music={message.music} note={message.textContent} isOwn={isOwn} group={group} />
    </div>
  ) : (
    <ShhhBubble
      side={isOwn ? "outgoing" : "incoming"}
      group={group}
      className={cn(
        "animate-shhh-settle",
        status === "failed" && "ring-danger/40 ring-1",
        highlighted && "shhh-target-highlight",
      )}
    >
      {message.replyTo ? (
        <div className="mb-1.5">
          <ReplyPreviewStrip
            preview={message.replyTo}
            senderName={message.replyTo.senderId === userId ? selfName : partnerName}
            onOpen={
              message.replyTo.deleted ? undefined : () => onJumpToReply?.(message.replyTo!.id)
            }
          />
        </div>
      ) : null}
      <ChatMessageBody text={message.textContent} />
    </ShhhBubble>
  );

  const mediaReply =
    !deleted && message.replyTo && (isPhoto || isVideo || isVoice || isSticker || isDoodle || isMusic) ? (
      <div className={cn("mb-1 max-w-full", isOwn ? "self-end" : "self-start")}>
        <ReplyPreviewStrip
          preview={message.replyTo}
          senderName={message.replyTo.senderId === userId ? selfName : partnerName}
          onOpen={message.replyTo.deleted ? undefined : () => onJumpToReply?.(message.replyTo!.id)}
        />
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      data-message-id={message.id}
      data-client-id={message.clientGeneratedId}
      data-status={isOwn ? status : undefined}
      data-own={isOwn ? "true" : "false"}
      data-group={group}
      data-highlighted={highlighted ? "true" : undefined}
      data-deleted={deleted ? "true" : undefined}
      tabIndex={-1}
      className={cn(
        "group relative flex flex-col outline-none",
        isOwn ? "items-end" : "items-start",
        group === "middle" || group === "last" ? "mt-1" : "mt-2.5",
        lifted &&
          "z-20 scale-[1.015] transition-transform duration-[var(--shhh-motion-fast)] motion-reduce:scale-100 motion-reduce:transition-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => {
        if (actions.length === 0) return;
        event.preventDefault();
        openMenu();
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
    >
      <div className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}>
        <div
          ref={bubbleRef}
          className="relative max-w-[85%] min-w-0 [&_.shhh-bubble-radius]:!max-w-none"
        >
          <SwipeToReply offset={offset}>
            <div className="flex flex-col items-stretch">
              {mediaReply}
              {body}
            </div>
          </SwipeToReply>
          {showMore ? (
            <div
              className={cn(
                "absolute top-1/2 z-10 -translate-y-1/2",
                "pointer-events-none opacity-0 transition-opacity duration-[var(--shhh-motion-fast)]",
                "group-hover:pointer-events-auto group-hover:opacity-100",
                "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                "motion-reduce:transition-none",
                isOwn ? "right-[calc(100%+2px)]" : "left-[calc(100%+2px)]",
                (menuOpen || lifted) && "pointer-events-auto opacity-100",
              )}
            >
              <ShhhIconButton
                type="button"
                label="Message actions"
                data-testid="message-more"
                data-message-gesture-ignore
                className="text-muted-text hover:bg-bg-soft/80 size-9 bg-transparent shadow-none hover:translate-y-0 hover:shadow-none active:translate-y-0 active:scale-100"
                onClick={(event) => {
                  event.stopPropagation();
                  openMenu();
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </ShhhIconButton>
            </div>
          ) : null}
        </div>
      </div>
      {deleted ? null : (
        <ReactionSummary
          reactions={message.reactions}
          userId={userId}
          partnerName={partnerName}
          selfName={selfName}
          isOwn={isOwn}
          onOpen={flags.canReact ? () => openMenu() : undefined}
        />
      )}
      {showMeta ? (
        <div
          dir="ltr"
          className={cn(
            "shhh-message-meta text-muted-text flex max-w-[85%] flex-wrap items-center gap-x-1 px-1.5 text-[11px]",
            hasReactions ? "mt-1.5" : "mt-1",
            isOwn ? "ms-auto justify-end" : "justify-start",
          )}
        >
          {showTime ? (
            <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          ) : null}
          {message.editedAt ? (
            <span data-testid="edited-indicator">{showTime ? " · Edited" : "Edited"}</span>
          ) : null}
          {showOwnStatus ? (
            status === "failed" ? (
              <button
                type="button"
                className="text-danger max-w-[16rem] text-end"
                onClick={onRetry}
                data-testid="message-retry"
                data-message-gesture-ignore
              >
                {showTime
                  ? `· ${statusLabel(status, isMedia, message.uploadError)}`
                  : statusLabel(status, isMedia, message.uploadError)}
              </button>
            ) : (
              <span
                key={status}
                className={cn(
                  "animate-shhh-status-in transition-colors duration-[var(--shhh-motion-normal)]",
                  status === "read" && "text-accent",
                )}
                aria-label={statusLabel(status, isMedia, message.uploadError)}
                data-testid="message-status"
              >
                {showTime
                  ? `· ${statusLabel(status, isMedia, message.uploadError)}`
                  : statusLabel(status, isMedia, message.uploadError)}
              </span>
            )
          ) : null}
        </div>
      ) : null}
      <MessageActionsMenu
        open={menuOpen}
        onClose={closeOverlays}
        anchor={anchor}
        align={isOwn ? "end" : "start"}
        actions={actions}
        selectedReaction={mine}
        picking={emojiPickerOpen}
        onReact={
          flags.canReact
            ? (emoji) => {
                const next = mine === emoji ? null : emoji;
                closeOverlays();
                onReact?.(message, next);
              }
            : undefined
        }
        onAction={handleAction}
      />
      <DeleteMessageConfirm
        open={confirmOpen}
        keepsMedia={isPhoto || isVideo}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          setLifted(false);
          onDelete?.(message);
        }}
      />
      {renameOpen ? (
        <StickerRenameDialog
          open
          initialName={message.sticker?.name}
          onClose={() => setRenameOpen(false)}
          onSave={(name) => {
            setRenameOpen(false);
            onRenameSticker?.(message, name);
          }}
        />
      ) : null}
    </div>
  );
}
