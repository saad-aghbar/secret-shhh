"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SoftBoundary } from "@/components/shhh/soft-boundary";
import { ChatComposer } from "@/features/chat/chat-composer";
import { ChatMediaViewerHost } from "@/features/chat/chat-media-viewer";
import { ChatDoodleViewerHost } from "@/features/doodles/doodle-viewer-host";
import { DOODLE_ASPECT_RATIO, DOODLE_BACKGROUND_MODE, DOODLE_VECTOR_VERSION } from "@/lib/doodles/limits";

const DoodleEditor = dynamic(
  () => import("@/features/doodles/doodle-editor").then((mod) => mod.DoodleEditor),
  { ssr: false },
);
import { ChatMessageList } from "@/features/chat/chat-message-list";
import { ConnectionBanner } from "@/features/chat/connection-banner";
import { JumpToLatestControl } from "@/features/chat/jump-to-latest-control";
import { TypingIndicator } from "@/features/chat/typing-indicator";
import { useChatRealtime } from "@/features/chat/use-chat-realtime";
import { useChatThread, type ReplyTarget } from "@/features/chat/use-chat-thread";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { snippetFromText } from "@/lib/chat/reply-preview";
import type { ChatMessage, ReplyPreview } from "@/lib/chat/types";
import { rememberOfflineConversation } from "@/lib/privacy/local-lock";
import { pauseActivePlayback } from "@/lib/media/playback-coordinator";
import { isRealtimeConfigured } from "@/lib/realtime/supabase";
import { apiRenameSticker, apiSetStickerLibrary } from "@/lib/stickers/client-api";
import { STICKERS_QUERY_KEY } from "@/features/stickers/sticker-tray";
import { apiMarkDelivered, apiMarkRead } from "@/lib/sync/api";
import type { ReceiptPatch } from "@/lib/sync/merge";

type ChatExperienceProps = {
  userId: string;
  conversationId: string;
  selfName: string;
  partnerName: string;
  initialMessages: ChatMessage[];
};

export function ChatExperience({
  userId,
  conversationId,
  selfName,
  partnerName,
  initialMessages,
}: ChatExperienceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const focusMessageId = searchParams.get("focus");
  const thread = useChatThread({
    userId,
    conversationId,
    initialMessages,
    focusMessageId,
  });
  const keyboardInset = useKeyboardInset();
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [nearBottom, setNearBottom] = useState(!focusMessageId);
  const [unseen, setUnseen] = useState(0);
  const [scrollToken, setScrollToken] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [scrollToMessageToken, setScrollToMessageToken] = useState(0);
  const [composerMode, setComposerMode] = useState<
    { kind: "reply"; target: ReplyTarget } | { kind: "edit"; message: ChatMessage } | null
  >(null);
  const [doodleOpen, setDoodleOpen] = useState(false);
  const optimisticMedia = thread.messages.filter(
    (message) => message.id === message.clientGeneratedId,
  ).length;
  const focusApplied = useRef(false);
  const focusToken = useRef(0);
  const deliveredQueue = useRef(new Set<string>());
  const readQueue = useRef(new Set<string>());
  const deliveredDone = useRef(new Set<string>());
  const readDone = useRef(new Set<string>());
  const countedUnseenIds = useRef(new Set<string>());
  const seenNewestId = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.id ?? null,
  );
  const nearBottomRef = useRef(nearBottom);
  useEffect(() => {
    nearBottomRef.current = nearBottom;
  }, [nearBottom]);
  useEffect(() => {
    rememberOfflineConversation(userId, conversationId);
  }, [userId, conversationId]);
  useEffect(() => {
    // Warm the doodle chunk after chat is up so offline compose still works.
    void import("@/features/doodles/doodle-editor");
  }, []);
  const historicalModeRef = useRef(thread.historicalMode);
  useEffect(() => {
    historicalModeRef.current = thread.historicalMode;
  }, [thread.historicalMode]);
  const publishTypingRef = useRef<(active: boolean) => void>(() => undefined);
  const typingExpire = useRef<number | null>(null);

  useEffect(() => {
    focusApplied.current = false;
    focusToken.current += 1;
  }, [focusMessageId]);

  useEffect(() => {
    if (thread.focusMiss && focusMessageId) {
      const from = searchParams.get("from");
      // Send people back where they came from, not always to Search.
      if (from === "media") {
        router.replace("/media?unavailable=1");
        return;
      }
      const qs = new URLSearchParams({ unavailable: "1" });
      if (from === "history") {
        qs.set("tab", "history");
      }
      router.replace(`/more/search?${qs.toString()}`);
    }
  }, [focusMessageId, router, searchParams, thread.focusMiss]);

  useEffect(() => {
    if (!focusMessageId || !thread.focusReady || focusApplied.current || thread.focusMiss) {
      return;
    }
    const token = focusToken.current;
    focusApplied.current = true;
    const frame = window.requestAnimationFrame(() => {
      if (token !== focusToken.current) return;
      setHighlightMessageId(focusMessageId);
      setNearBottom(false);
      setScrollToMessageToken((current) => current + 1);
    });
    const timer = window.setTimeout(() => {
      if (token !== focusToken.current) return;
      setHighlightMessageId(null);
    }, 8_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusMessageId, thread.focusMiss, thread.focusReady]);

  const onTypingSignal = useCallback((active: boolean) => {
    if (typingExpire.current) {
      window.clearTimeout(typingExpire.current);
      typingExpire.current = null;
    }
    setPartnerTyping(active);
    if (active) {
      typingExpire.current = window.setTimeout(() => {
        setPartnerTyping(false);
      }, 3_200);
    }
  }, []);

  const syncNew = thread.syncNew;
  const reconcileRecent = thread.reconcileRecent;
  const patchReceipts = thread.patchReceipts;

  const pullLive = useCallback(async () => {
    await syncNew();
    // Reconciling the newest page would throw away a Search/History focus window.
    if (!historicalModeRef.current) {
      await reconcileRecent();
    }
  }, [reconcileRecent, syncNew]);

  const onReceipt = useCallback(
    (patches: ReceiptPatch[]) => {
      if (patches.length > 0) {
        void patchReceipts(patches);
      }
      void syncNew();
    },
    [patchReceipts, syncNew],
  );

  const { publishTyping, realtimeSubscribed } = useChatRealtime({
    conversationId,
    userId,
    onMessage: () => {
      void pullLive();
    },
    onReceipt,
    onTyping: onTypingSignal,
    onMediaChanged: () => {
      if (!historicalModeRef.current) {
        void reconcileRecent();
      }
    },
    onMessageMutated: (messageId) => {
      void thread.applyRemoteMessage(messageId);
    },
  });

  useEffect(() => {
    publishTypingRef.current = publishTyping;
  }, [publishTyping]);

  // A note must not still be talking when the page is frozen or restored from bfcache.
  useEffect(() => {
    const onLeave = () => pauseActivePlayback();
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  useEffect(() => {
    const intervalMs = isRealtimeConfigured() ? 8_000 : 5_000;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pullLive();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [pullLive]);

  useEffect(() => {
    const messages = thread.messages;
    if (messages.length === 0) {
      return;
    }
    const newest = messages[messages.length - 1]!;
    const previous = seenNewestId.current;
    if (newest.id === previous) {
      return;
    }
    seenNewestId.current = newest.id;
    if (!previous || nearBottomRef.current) {
      return;
    }
    const previousIndex = messages.findIndex((message) => message.id === previous);
    const tail = previousIndex >= 0 ? messages.slice(previousIndex + 1) : [newest];
    const arrived = tail.filter(
      (message) => message.senderId !== userId && !countedUnseenIds.current.has(message.id),
    );
    if (arrived.length === 0) {
      return;
    }
    for (const message of arrived) {
      countedUnseenIds.current.add(message.id);
    }
    setUnseen((count) => count + arrived.length);
  }, [thread.messages, userId]);

  // Delivered = partner's device received the message (sync/realtime), not viewport.
  useEffect(() => {
    for (const message of thread.messages) {
      if (message.senderId === userId) continue;
      if (message.id === message.clientGeneratedId) continue;
      if (deliveredDone.current.has(message.id)) continue;
      deliveredQueue.current.add(message.id);
    }
  }, [thread.messages, userId]);

  const onMessageVisible = useCallback(
    (message: ChatMessage) => {
      if (message.senderId === userId) {
        return;
      }
      // Read still requires the bubble to enter the viewport.
      if (!readDone.current.has(message.id)) {
        readQueue.current.add(message.id);
      }
    },
    [userId],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const delivered = [...deliveredQueue.current];
      const read = [...readQueue.current];
      deliveredQueue.current.clear();
      readQueue.current.clear();
      if (delivered.length) {
        for (const mid of delivered) {
          deliveredDone.current.add(mid);
        }
        void apiMarkDelivered(delivered);
      }
      if (read.length) {
        for (const mid of read) {
          readDone.current.add(mid);
        }
        void apiMarkRead(read);
      }
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  function previewFromMessage(message: ChatMessage): ReplyPreview {
    return {
      id: message.id,
      senderId: message.senderId,
      type: message.type,
      textSnippet:
        message.type === "sticker"
          ? snippetFromText(message.sticker?.name ?? "")
          : message.type === "music"
            ? snippetFromText(message.music?.title ?? message.textContent)
            : snippetFromText(message.textContent),
      mediaPreviewId: message.media?.[0]?.id ?? null,
      durationMs: message.media?.[0]?.durationMs ?? null,
      sticker: message.sticker ?? null,
      doodle: message.doodle ?? null,
      music: message.music ?? null,
      deleted: Boolean(message.deletedAt),
    };
  }

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const loaded = thread.messages.some((message) => message.id === messageId);
      if (!loaded) {
        const ok = await thread.openAround(messageId);
        if (!ok) return;
      }
      setHighlightMessageId(messageId);
      setNearBottom(false);
      setScrollToMessageToken((token) => token + 1);
      window.setTimeout(() => {
        setHighlightMessageId((current) => (current === messageId ? null : current));
      }, 2500);
    },
    [thread],
  );

  const jumpToLatest = useCallback(async () => {
    if (thread.historicalMode) {
      await thread.returnToLatest();
    }
    setNearBottom(true);
    setUnseen(0);
    countedUnseenIds.current.clear();
    setHighlightMessageId(null);
    if (focusMessageId) {
      router.replace("/chat");
    }
    setScrollToken((token) => token + 1);
  }, [focusMessageId, router, thread]);

  const bottomPadding =
    keyboardInset > 80 ? `${keyboardInset + 8}px` : "calc(5.25rem + var(--shhh-safe-bottom))";

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      style={{ paddingBottom: bottomPadding }}
      data-testid="chat-experience"
      data-composer-mode={composerMode?.kind ?? "idle"}
      data-conversation-id={conversationId}
      data-user-id={userId}
      data-historical={thread.historicalMode ? "true" : "false"}
      data-optimistic-media={String(optimisticMedia)}
      data-realtime={
        realtimeSubscribed ? "subscribed" : isRealtimeConfigured() ? "connecting" : "off"
      }
    >
      <ConnectionBanner state={thread.connection} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatMessageList
          messages={thread.messages}
          pending={thread.pending}
          userId={userId}
          selfName={selfName}
          partnerName={partnerName}
          hasMore={thread.hasMore}
          loadingOlder={thread.loadingOlder}
          stickToBottom={
            (nearBottom && !thread.historicalMode) || (optimisticMedia > 0 && !focusMessageId)
          }
          focusMessageId={focusMessageId}
          focusReady={thread.focusReady}
          highlightMessageId={highlightMessageId}
          onLoadOlder={() => thread.loadOlder()}
          onNearBottomChange={(near) => {
            // Mid-history window end is not conversation-latest — keep ↓ until returnToLatest.
            if (thread.historicalMode) {
              if (!near) {
                setNearBottom(false);
              }
              return;
            }
            setNearBottom(near);
            if (near) {
              setUnseen(0);
              countedUnseenIds.current.clear();
            }
          }}
          onRetry={thread.retry}
          onMessageVisible={onMessageVisible}
          scrollToBottomToken={scrollToken}
          scrollToMessageToken={scrollToMessageToken}
          scrollToMessageId={highlightMessageId}
          onReply={(message) => {
            if (message.deletedAt) return;
            setComposerMode({
              kind: "reply",
              target: { id: message.id, preview: previewFromMessage(message) },
            });
          }}
          onReact={(message, emoji) => {
            void thread.reactToMessage(message, emoji);
          }}
          onEdit={(message) => {
            setComposerMode({ kind: "edit", message });
            thread.setDraft(message.textContent);
          }}
          onDelete={(message) => {
            void thread.deleteMessage(message);
          }}
          onJumpToReply={(id) => {
            void jumpToMessage(id);
          }}
          onSaveSticker={(message) => {
            if (!message.sticker) return;
            void apiSetStickerLibrary(message.sticker.id, true).then(() => {
              void queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
              void thread.applyRemoteMessage(message.id);
            });
          }}
          onUnsaveSticker={(message) => {
            if (!message.sticker) return;
            void apiSetStickerLibrary(message.sticker.id, false).then(() => {
              void queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
              void thread.applyRemoteMessage(message.id);
            });
          }}
          onRenameSticker={(message, name) => {
            if (!message.sticker) return;
            void apiRenameSticker(message.sticker.id, name).then(() => {
              void queryClient.invalidateQueries({ queryKey: STICKERS_QUERY_KEY });
              void thread.applyRemoteMessage(message.id);
            });
          }}
        />
        <JumpToLatestControl
          visible={!nearBottom || thread.historicalMode}
          unseen={unseen}
          onClick={() => {
            void jumpToLatest();
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-transparent">
          <div className="pointer-events-none absolute inset-x-0 bottom-full">
            <TypingIndicator name={partnerName} active={partnerTyping} />
          </div>
          <div className="pointer-events-auto bg-transparent">
            {thread.mutationError ? (
              <p
                className="text-muted-text px-4 pb-1 text-center text-[12px]"
                data-testid="mutation-error"
              >
                {thread.mutationError}
              </p>
            ) : null}
            <ChatComposer
              value={thread.draft}
              onChange={thread.setDraft}
              userId={userId}
              context={
                composerMode?.kind === "reply"
                  ? {
                      mode: "reply",
                      senderName:
                        composerMode.target.preview.senderId === userId ? selfName : partnerName,
                      preview: composerMode.target.preview,
                    }
                  : composerMode?.kind === "edit"
                    ? { mode: "edit" }
                    : null
              }
              onCancelContext={() => {
                if (composerMode?.kind === "edit") {
                  thread.setDraft("");
                }
                setComposerMode(null);
              }}
              onSend={(text) => {
                publishTypingRef.current(false);
                if (composerMode?.kind === "edit") {
                  void thread.editMessage(composerMode.message, text);
                  thread.setDraft("");
                  setComposerMode(null);
                  return;
                }
                const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
                void thread.send(text, reply);
                setComposerMode(null);
                void jumpToLatest();
              }}
              onSendPhotos={(files, caption) => {
                publishTypingRef.current(false);
                const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
                void thread.sendPhotos(files, caption, reply);
                setComposerMode(null);
                void jumpToLatest();
              }}
              onSendVideo={(file, caption, origin) => {
                publishTypingRef.current(false);
                const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
                void thread.sendVideo(file, caption, origin, reply);
                setComposerMode(null);
                void jumpToLatest();
              }}
              onSendVoice={(recording) => {
                publishTypingRef.current(false);
                const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
                void thread.sendVoice(recording, reply);
                setComposerMode(null);
                void jumpToLatest();
              }}
              onSendSticker={(sticker) => {
                publishTypingRef.current(false);
                const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
                void thread.sendSticker(sticker, reply);
                void jumpToLatest();
              }}
              onOpenDoodle={() => {
                publishTypingRef.current(false);
                setDoodleOpen(true);
              }}
              partnerName={partnerName}
              onTyping={(active) => publishTypingRef.current(active)}
            />
          </div>
        </div>
      </div>
      <ChatMediaViewerHost />
      <ChatDoodleViewerHost />
      <SoftBoundary>
        <DoodleEditor
          key={doodleOpen ? "open" : "closed"}
          open={doodleOpen}
          partnerName={partnerName}
          conversationId={conversationId}
          userId={userId}
          onClose={() => setDoodleOpen(false)}
          onSend={(document) => {
            const reply = composerMode?.kind === "reply" ? composerMode.target : undefined;
            void thread.sendDoodle(
              {
                id: crypto.randomUUID(),
                version: DOODLE_VECTOR_VERSION,
                aspectRatio: DOODLE_ASPECT_RATIO,
                backgroundMode: DOODLE_BACKGROUND_MODE,
                document,
              },
              reply,
            );
            setComposerMode(null);
            setDoodleOpen(false);
            void jumpToLatest();
          }}
        />
      </SoftBoundary>
    </div>
  );
}
