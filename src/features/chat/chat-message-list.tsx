"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";

import { ShhhEmptyState, ShhhSpinner } from "@/components/shhh";
import { ChatDateSeparator } from "@/features/chat/chat-date-separator";
import { ChatMessageRow } from "@/features/chat/chat-message-row";
import { navigateChatToEnd, navigateChatToMessage } from "@/features/chat/scroll-navigation";
import { buildChatRows } from "@/lib/chat/layout";
import type { ChatMessage, MessageSendStatus } from "@/lib/chat/types";
import type { PendingMessage } from "@/lib/sync/merge";
import { outgoingStatus } from "@/lib/sync/merge";

/** Shared near-bottom threshold — jump control + stickiness use this only. */
export const NEAR_BOTTOM_PX = 96;

type ChatMessageListProps = {
  messages: ChatMessage[];
  pending: PendingMessage[];
  userId: string;
  selfName: string;
  partnerName: string;
  hasMore: boolean;
  loadingOlder: boolean;
  /** True when the user is already near the bottom — appends may pin scroll. */
  stickToBottom: boolean;
  focusMessageId?: string | null;
  focusReady?: boolean;
  highlightMessageId?: string | null;
  onLoadOlder: () => void | Promise<void>;
  onNearBottomChange: (near: boolean) => void;
  onRetry: (clientGeneratedId: string) => void;
  onMessageVisible: (message: ChatMessage) => void;
  /** Explicit “jump to newest” (control / own send) — never tied to row count. */
  scrollToBottomToken: number;
  scrollToMessageToken?: number;
  scrollToMessageId?: string | null;
  onReply?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage, emoji: string | null) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onJumpToReply?: (messageId: string) => void;
  onSaveSticker?: (message: ChatMessage) => void;
  onUnsaveSticker?: (message: ChatMessage) => void;
  onRenameSticker?: (message: ChatMessage, name: string | null) => void;
};

/**
 * Scroll cases (do not conflate):
 * A) Initial load → once to newest (skipped when focusing a historical message)
 * B) Near bottom + newer message → stay pinned
 * C) Reading history + newer message → do not move (parent shows jump control)
 * D) Older page prepend → preserve viewport via height delta (not row-count scroll)
 * E) Search/History focus → navigateChatToMessage once focusReady
 */
export function ChatMessageList({
  messages,
  pending,
  userId,
  selfName,
  partnerName,
  hasMore,
  loadingOlder,
  stickToBottom,
  focusMessageId = null,
  focusReady = true,
  highlightMessageId = null,
  onLoadOlder,
  onNearBottomChange,
  onRetry,
  onMessageVisible,
  scrollToBottomToken,
  scrollToMessageToken = 0,
  scrollToMessageId = null,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onJumpToReply,
  onSaveSticker,
  onUnsaveSticker,
  onRenameSticker,
}: ChatMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(!focusMessageId);
  const didInitialScroll = useRef(false);
  const didFocusScroll = useRef(false);
  const loadingOlderRef = useRef(false);
  const lastNewestIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(stickToBottom);
  useEffect(() => {
    stickToBottomRef.current = stickToBottom;
    if (!stickToBottom) {
      nearBottomRef.current = false;
    }
  }, [stickToBottom]);

  const pendingByClient = useMemo(() => {
    const map = new Map<string, PendingMessage>();
    for (const item of pending) {
      map.set(item.clientGeneratedId, item);
    }
    return map;
  }, [pending]);

  const rows = useMemo(() => buildChatRows(messages), [messages]);
  const newestId = messages[messages.length - 1]?.id ?? null;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row || row.kind === "date") return 44;
      if (row.message.type === "image") return 280;
      if (row.message.type === "video") return 260;
      if (row.message.type === "audio") return 68;
      if (row.message.type === "sticker") return 180;
      if (row.message.type === "doodle") return 360;
      if (row.message.type === "music") return row.message.music?.clipEndMs ? 96 : 88;
      if (row.message.type === "call") return 92;
      return 72;
    },
    overscan: 14,
    getItemKey: (index) => rows[index]?.key ?? index,
    // measureElement can sync-rerender during React commit; flushSync then throws.
    useFlushSync: false,
  });

  // Case A — initial conversation position (once). Skip when focusing history.
  useEffect(() => {
    if (focusMessageId || didInitialScroll.current || rows.length === 0) {
      return;
    }
    didInitialScroll.current = true;
    lastNewestIdRef.current = newestId;

    /*
     * Rows start at the 72px estimate and grow as they measure — a photo bubble
     * is closer to 300. A single scroll to the end therefore lands short: by the
     * time the rows above have measured, the newest message sits thousands of
     * pixels below the fold and the reader is greeted by a jump control instead
     * of the message they came for. Re-anchor each frame until the measurements
     * stop moving, and stop the moment the reader takes over.
     */
    let frame = 0;
    let settledFrames = 0;
    let lastSize = -1;
    let anchoredTop = -1;
    let ignoreScrollUntil = 0;
    const node = parentRef.current;

    const release = () => {
      cancelAnimationFrame(frame);
      node?.removeEventListener("scroll", onScroll);
    };

    function onScroll() {
      if (!node) return;
      if (performance.now() < ignoreScrollUntil) return;
      if (anchoredTop < 0) return;
      // Only the reader — not our own scrollToIndex — may cancel the settle.
      if (Math.abs(node.scrollTop - anchoredTop) > 48) release();
    }

    const settle = () => {
      if (!node) return;
      const size = virtualizer.getTotalSize();
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      settledFrames = size === lastSize && distance < 80 ? settledFrames + 1 : 0;
      lastSize = size;
      if (settledFrames >= 8) {
        release();
        return;
      }
      ignoreScrollUntil = performance.now() + 80;
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      anchoredTop = node.scrollTop;
      frame = requestAnimationFrame(settle);
    };

    node?.addEventListener("scroll", onScroll, { passive: true });
    frame = requestAnimationFrame(settle);
    // Photos have measured long before this; the cap is only a safety net.
    const stop = window.setTimeout(release, 12_000);

    return () => {
      window.clearTimeout(stop);
      release();
    };
  }, [focusMessageId, newestId, rows.length, virtualizer]);

  // Case E — Search/History focus target (ignore stale boots if focus id changes).
  useEffect(() => {
    didFocusScroll.current = false;
  }, [focusMessageId]);

  useEffect(() => {
    if (!focusMessageId || !focusReady || rows.length === 0) {
      return;
    }
    const index = rows.findIndex(
      (row) => row.kind === "message" && row.message.id === focusMessageId,
    );
    if (index < 0) {
      return;
    }
    if (didFocusScroll.current) {
      const mounted = parentRef.current?.querySelector(`[data-message-id="${focusMessageId}"]`);
      if (mounted) return;
    }
    let cancelled = false;
    const token = focusMessageId;
    didFocusScroll.current = true;
    didInitialScroll.current = true;
    lastNewestIdRef.current = newestId;
    nearBottomRef.current = false;
    onNearBottomChange(false);
    void navigateChatToMessage(parentRef.current, virtualizer, index, { motion: "shhh" }).then(
      () => {
        if (cancelled || token !== focusMessageId) return;
        const mounted = parentRef.current?.querySelector(`[data-message-id="${focusMessageId}"]`);
        if (mounted) return;
        didFocusScroll.current = false;
        window.setTimeout(() => {
          if (cancelled || token !== focusMessageId) return;
          const retry = rows.findIndex(
            (row) => row.kind === "message" && row.message.id === token,
          );
          if (retry < 0) return;
          didFocusScroll.current = true;
          void navigateChatToMessage(parentRef.current, virtualizer, retry, { motion: "shhh" });
        }, 320);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [focusMessageId, focusReady, newestId, onNearBottomChange, rows, virtualizer]);

  // Case B — append while near bottom. Case C — skip when scrolled up.
  useEffect(() => {
    if (!didInitialScroll.current || !newestId) {
      return;
    }
    if (lastNewestIdRef.current === newestId) {
      return;
    }
    const previous = lastNewestIdRef.current;
    lastNewestIdRef.current = newestId;
    if (!previous) {
      return;
    }
    const node = parentRef.current;
    if (!node) {
      return;
    }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distance < NEAR_BOTTOM_PX) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      });
    }
  }, [newestId, rows.length, virtualizer]);

  // Explicit jump (control / own send) — smooth when motion allows.
  // Token 0 is the mount sentinel; only token > 0 should navigate (avoid eating the first ↓ after Search focus).
  useEffect(() => {
    if (!didInitialScroll.current || rows.length === 0) {
      return;
    }
    if (scrollToBottomToken === 0) {
      return;
    }
    const node = parentRef.current;
    void navigateChatToEnd(node, virtualizer, rows.length - 1, { motion: "shhh" }).then(() => {
      nearBottomRef.current = true;
      onNearBottomChange(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the intentional trigger
  }, [scrollToBottomToken]);

  useEffect(() => {
    if (!scrollToMessageToken || !scrollToMessageId || rows.length === 0) {
      return;
    }
    const index = rows.findIndex(
      (row) => row.kind === "message" && row.message.id === scrollToMessageId,
    );
    if (index < 0) return;
    void navigateChatToMessage(parentRef.current, virtualizer, index, { motion: "shhh" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token triggers; length retries when the focus window arrives
  }, [scrollToMessageToken, scrollToMessageId, rows.length]);

  function onScroll() {
    const node = parentRef.current;
    if (!node) {
      return;
    }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const near = distance < NEAR_BOTTOM_PX;
    if (near !== nearBottomRef.current) {
      nearBottomRef.current = near;
      onNearBottomChange(near);
    }

    if (node.scrollTop < 80 && hasMore && !loadingOlder && !loadingOlderRef.current) {
      loadingOlderRef.current = true;
      const previousHeight = node.scrollHeight;
      const previousTop = node.scrollTop;
      void Promise.resolve(onLoadOlder()).finally(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (parentRef.current) {
              const delta = parentRef.current.scrollHeight - previousHeight;
              parentRef.current.scrollTop = previousTop + delta;
            }
            loadingOlderRef.current = false;
          });
        });
      });
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ShhhEmptyState
          title="Quiet here for now"
          description="Your private conversation will settle in softly."
        />
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3"
      style={{ paddingBottom: "calc(4.75rem + var(--shhh-mini-player, 0px))" }}
      onScroll={onScroll}
      data-testid="chat-message-list"
    >
      {loadingOlder ? (
        <div className="flex justify-center py-3">
          <ShhhSpinner className="size-6" label="Loading earlier messages" />
        </div>
      ) : null}
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) {
            return null;
          }
          return (
            <div
              key={row.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {row.kind === "date" ? (
                <ChatDateSeparator label={row.label} />
              ) : (
                <ChatMessageRow
                  message={row.message}
                  group={row.group}
                  showTime={row.showTime}
                  isOwn={row.message.senderId === userId}
                  senderName={row.message.senderId === userId ? selfName : partnerName}
                  selfName={selfName}
                  partnerName={partnerName}
                  userId={userId}
                  highlighted={highlightMessageId === row.message.id}
                  status={
                    outgoingStatus(
                      row.message,
                      pendingByClient.get(row.message.clientGeneratedId),
                      row.message.senderId === userId,
                    ) as MessageSendStatus
                  }
                  onRetry={() => onRetry(row.message.clientGeneratedId)}
                  onVisible={onMessageVisible}
                  onReply={onReply}
                  onReact={onReact}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onJumpToReply={onJumpToReply}
                  onSaveSticker={onSaveSticker}
                  onUnsaveSticker={onUnsaveSticker}
                  onRenameSticker={onRenameSticker}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
