"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { compareMessages, tombstoneMessage } from "@/lib/chat/serialize";
import type { ChatMessage, DoodleRef, ReplyPreview, StickerRef } from "@/lib/chat/types";
import { connectionManager, type ConnectionState } from "@/lib/connection/manager";
import { backoffMs } from "@/lib/sync/backoff";
import { getChatDb } from "@/lib/sync/db";
import {
  enqueueMutation,
  enqueueOutgoing,
  fetchMessageById,
  flushPendingMutations,
  flushPendingQueue,
  getDraft,
  hydrateLocalThread,
  listPendingMutations,
  loadAroundIntoCache,
  loadOlderIntoCache,
  loadRecentIntoCache,
  mutationKey,
  OUTBOX_CHANGED_EVENT,
  patchCachedMessage,
  patchCachedReceipts,
  putCachedMessages,
  refreshOutgoingReceipts,
  rememberNewest,
  saveDraft,
  sendMutationOnce,
  sendPendingOnce,
  syncAfterCursor,
  updatePending,
} from "@/lib/sync/engine";
import {
  applyReceiptPatches,
  mergeMessages,
  reconcileCachedMessage,
  upsertMessage,
  type PendingMessage,
  type PendingMutation,
  type ReceiptPatch,
} from "@/lib/sync/merge";
import { uploadManager } from "@/lib/uploads/manager";

export type ReplyTarget = {
  id: string;
  preview: ReplyPreview;
};

type UseChatThreadArgs = {
  userId: string;
  conversationId: string;
  initialMessages: ChatMessage[];
  /** When set, boot into a mid-history context window instead of newest. */
  focusMessageId?: string | null;
};

export function useChatThread({
  userId,
  conversationId,
  initialMessages,
  focusMessageId = null,
}: UseChatThreadArgs) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [photoMessages, setPhotoMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>(connectionManager.getState());
  const [draft, setDraftState] = useState("");
  const [historicalMode, setHistoricalMode] = useState(Boolean(focusMessageId));
  const [focusReady, setFocusReady] = useState(!focusMessageId);
  const [focusMiss, setFocusMiss] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>([]);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const draftEdited = useRef(false);
  const initialRef = useRef(initialMessages);
  const focusRef = useRef(focusMessageId);
  useEffect(() => {
    focusRef.current = focusMessageId;
  }, [focusMessageId]);
  const oldestId = messages[0]?.id ?? null;
  const newestIdRef = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.id ?? null,
  );
  const historicalModeRef = useRef(historicalMode);
  useEffect(() => {
    historicalModeRef.current = historicalMode;
  }, [historicalMode]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshPending = useCallback(async () => {
    const db = getChatDb();
    const rows = await db.pendingMessages.where("conversationId").equals(conversationId).toArray();
    setPending(rows);
  }, [conversationId]);

  useEffect(() => {
    const onOutbox = () => {
      void refreshPending();
    };
    window.addEventListener(OUTBOX_CHANGED_EVENT, onOutbox);
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, onOutbox);
  }, [refreshPending]);

  const refreshMutations = useCallback(async () => {
    setPendingMutations(await listPendingMutations());
  }, []);

  const applyLocalMessage = useCallback(async (next: ChatMessage) => {
    setMessages((current) => upsertMessage(current, next));
    await patchCachedMessage(next);
  }, []);

  const queuedMutationIds = useMemo(() => {
    return new Set(
      pendingMutations
        .filter((item) => item.status === "queued" || item.status === "sending")
        .map((item) => item.messageId),
    );
  }, [pendingMutations]);

  const visibleMessages = useMemo(() => {
    const textMerged = mergeMessages(messages, pending);
    const byClient = new Map(textMerged.map((message) => [message.clientGeneratedId, message]));
    for (const message of photoMessages) {
      if (!byClient.has(message.clientGeneratedId)) {
        byClient.set(message.clientGeneratedId, message);
      }
    }
    return [...byClient.values()].sort(compareMessages);
  }, [messages, pending, photoMessages]);

  const patchReceipts = useCallback(async (patches: ReceiptPatch[]) => {
    if (patches.length === 0) {
      return;
    }
    setMessages((current) => applyReceiptPatches(current, patches));
    await patchCachedReceipts(patches);
  }, []);

  const refreshReceiptsForOutgoing = useCallback(async () => {
    const outgoingIds = messagesRef.current
      .filter((message) => message.senderId === userId && message.id !== message.clientGeneratedId)
      .slice(-100)
      .map((message) => message.id);
    if (outgoingIds.length === 0) {
      return;
    }
    try {
      const patches = await refreshOutgoingReceipts(outgoingIds);
      setMessages((current) => applyReceiptPatches(current, patches));
    } catch {
      // Offline / transient — next poll will try again.
    }
  }, [userId]);

  useEffect(() => {
    return uploadManager.subscribe((snapshot) => {
      // In-progress / failed optimistic rows (id === clientGeneratedId).
      setPhotoMessages(
        snapshot.optimisticMessages.filter(
          (message) =>
            message.conversationId === conversationId && message.id === message.clientGeneratedId,
        ),
      );
      // Finalized photos must land in `messages` so Delivered/Read polls apply
      // (sender does not receive own message:new broadcast).
      const finalized = uploadManager.takeFinalized(conversationId);
      if (finalized.length === 0) return;
      setMessages((current) => {
        let next = current;
        for (const message of finalized) {
          next = upsertMessage(next, message);
        }
        messagesRef.current = next;
        return next;
      });
      void putCachedMessages(finalized);
      const newest = finalized[finalized.length - 1];
      if (newest) {
        newestIdRef.current = newest.id;
        void rememberNewest(conversationId, newest.id);
      }
      void refreshReceiptsForOutgoing();
    });
  }, [conversationId, refreshReceiptsForOutgoing]);

  useEffect(() => {
    return connectionManager.subscribe(setConnection);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setFocusReady(!focusRef.current);
      setHistoricalMode(Boolean(focusRef.current));
      setFocusMiss(false);

      const local = await hydrateLocalThread(conversationId);
      if (cancelled) {
        return;
      }
      const seed = initialRef.current;
      const seeded = seed.length > 0 ? seed : local.messages;
      setMessages(mergeMessages(seeded, []));
      setPending(local.pending);
      void refreshMutations();

      const storedDraft = await getDraft(conversationId, userId);
      if (!cancelled && !draftEdited.current) {
        setDraftState(storedDraft);
      }

      // Focus window is loaded by a separate effect so clearing ?focus= does not re-hydrate newest.
      if (focusRef.current) {
        return;
      }

      if (seed.length > 0) {
        await putCachedMessages(seed);
        const newest = seed[seed.length - 1]?.id ?? null;
        newestIdRef.current = newest ?? local.lastServerMessageId;
        await rememberNewest(conversationId, newestIdRef.current);
      } else {
        newestIdRef.current = local.lastServerMessageId;
      }

      try {
        const page = await loadRecentIntoCache(conversationId);
        if (cancelled) {
          return;
        }
        setMessages(page.messages);
        setHasMore(Boolean(page.nextBeforeCursor));
        newestIdRef.current = page.newestId ?? newestIdRef.current;
        setHistoricalMode(false);
        setFocusReady(true);
        queryClient.setQueryData(["chat", conversationId], page);
      } catch {
        setFocusReady(true);
      }

      await flushPendingQueue(conversationId);
      await flushPendingMutations();
      if (!cancelled) {
        await refreshPending();
        await refreshMutations();
        await refreshReceiptsForOutgoing();
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    queryClient,
    refreshMutations,
    refreshPending,
    refreshReceiptsForOutgoing,
    userId,
  ]);

  useEffect(() => {
    if (!focusMessageId) {
      return;
    }
    const focusId = focusMessageId;

    let cancelled = false;

    async function loadFocus() {
      setFocusMiss(false);
      setFocusReady(false);
      setHistoricalMode(true);
      try {
        const around = await loadAroundIntoCache(focusId);
        if (cancelled || focusRef.current !== focusId) {
          return;
        }
        setMessages(around.messages);
        setHasMore(around.hasMoreOlder);
        newestIdRef.current = around.messages[around.messages.length - 1]?.id ?? null;
        setHistoricalMode(true);
        setFocusReady(true);
        await putCachedMessages(around.messages);
        await flushPendingQueue(conversationId);
        if (!cancelled) {
          await refreshPending();
          await refreshReceiptsForOutgoing();
        }
      } catch {
        if (cancelled || focusRef.current !== focusId) {
          return;
        }
        setFocusMiss(true);
        setFocusReady(true);
        setHistoricalMode(false);
      }
    }

    void loadFocus();
    return () => {
      cancelled = true;
    };
  }, [conversationId, focusMessageId, refreshPending, refreshReceiptsForOutgoing]);

  const persistDraft = useCallback(
    (value: string) => {
      draftEdited.current = true;
      setDraftState(value);
      void saveDraft(conversationId, userId, value);
    },
    [conversationId, userId],
  );

  const send = useCallback(
    async (text: string, reply?: ReplyTarget) => {
      const trimmed = text.replace(/^\s+|\s+$/gu, "");
      if (!trimmed) {
        return;
      }
      persistDraft("");
      const clientGeneratedId = crypto.randomUUID();
      const pendingRow: PendingMessage = {
        clientGeneratedId,
        conversationId,
        senderId: userId,
        textContent: trimmed,
        status: "queued",
        createdAt: new Date().toISOString(),
        retryCount: 0,
        replyToMessageId: reply?.id,
        replyTo: reply?.preview ?? null,
      };
      await enqueueOutgoing(pendingRow);
      setPending((current) => [...current, pendingRow]);

      const acked = await sendPendingOnce(pendingRow);
      if (acked) {
        setMessages((current) =>
          current.some((item) => item.clientGeneratedId === acked.clientGeneratedId)
            ? current.map((item) =>
                item.clientGeneratedId === acked.clientGeneratedId ? acked : item,
              )
            : [...current, acked],
        );
        newestIdRef.current = acked.id;
      }
      await refreshPending();
    },
    [conversationId, persistDraft, refreshPending, userId],
  );

  const sendSticker = useCallback(
    async (sticker: StickerRef, reply?: ReplyTarget) => {
      const clientGeneratedId = crypto.randomUUID();
      const pendingRow: PendingMessage = {
        clientGeneratedId,
        conversationId,
        senderId: userId,
        textContent: "",
        status: "queued",
        createdAt: new Date().toISOString(),
        retryCount: 0,
        replyToMessageId: reply?.id,
        replyTo: reply?.preview ?? null,
        stickerId: sticker.id,
        sticker,
      };
      await enqueueOutgoing(pendingRow);
      setPending((current) => [...current, pendingRow]);

      const acked = await sendPendingOnce(pendingRow);
      if (acked) {
        setMessages((current) =>
          current.some((item) => item.clientGeneratedId === acked.clientGeneratedId)
            ? current.map((item) =>
                item.clientGeneratedId === acked.clientGeneratedId ? acked : item,
              )
            : [...current, acked],
        );
        newestIdRef.current = acked.id;
      }
      await refreshPending();
    },
    [conversationId, refreshPending, userId],
  );

  const sendDoodle = useCallback(
    async (doodle: DoodleRef, reply?: ReplyTarget) => {
      const clientGeneratedId = crypto.randomUUID();
      const pendingRow: PendingMessage = {
        clientGeneratedId,
        conversationId,
        senderId: userId,
        textContent: "",
        status: "queued",
        createdAt: new Date().toISOString(),
        retryCount: 0,
        replyToMessageId: reply?.id,
        replyTo: reply?.preview ?? null,
        doodle,
      };
      await enqueueOutgoing(pendingRow);
      setPending((current) => [...current, pendingRow]);

      const acked = await sendPendingOnce(pendingRow);
      if (acked) {
        setMessages((current) =>
          current.some((item) => item.clientGeneratedId === acked.clientGeneratedId)
            ? current.map((item) =>
                item.clientGeneratedId === acked.clientGeneratedId ? acked : item,
              )
            : [...current, acked],
        );
        newestIdRef.current = acked.id;
      }
      await refreshPending();
    },
    [conversationId, refreshPending, userId],
  );

  const sendPhotos = useCallback(
    async (files: File[], caption: string, reply?: ReplyTarget) => {
      await uploadManager.enqueueAlbum({
        files,
        caption,
        conversationId,
        senderId: userId,
        clientGeneratedId: crypto.randomUUID(),
        replyToMessageId: reply?.id,
        replyTo: reply?.preview,
      });
    },
    [conversationId, userId],
  );

  const sendVoice = useCallback(
    async (
      recording: { file: File; durationMs: number; waveform: number[] },
      reply?: ReplyTarget,
    ) => {
      await uploadManager.enqueueVoice({
        file: recording.file,
        durationMs: recording.durationMs,
        waveform: recording.waveform,
        conversationId,
        senderId: userId,
        clientGeneratedId: crypto.randomUUID(),
        replyToMessageId: reply?.id,
        replyTo: reply?.preview,
      });
    },
    [conversationId, userId],
  );

  const sendVideo = useCallback(
    async (file: File, caption: string, origin?: "library" | "camera", reply?: ReplyTarget) => {
      await uploadManager.enqueueVideo({
        file,
        caption,
        conversationId,
        senderId: userId,
        clientGeneratedId: crypto.randomUUID(),
        origin,
        replyToMessageId: reply?.id,
        replyTo: reply?.preview,
      });
    },
    [conversationId, userId],
  );

  const queueMutation = useCallback(
    async (mutation: PendingMutation, optimistic: ChatMessage, snapshot: ChatMessage) => {
      await enqueueMutation(mutation);
      await applyLocalMessage(optimistic);
      await refreshMutations();
      const acked = await sendMutationOnce(mutation);
      if (acked) {
        await applyLocalMessage(acked);
        setMutationError(null);
      } else {
        const latest = (await listPendingMutations()).find((item) => item.id === mutation.id);
        if (latest?.status === "failed") {
          await applyLocalMessage(snapshot);
          setMutationError("That didn’t go through. Try again.");
        }
      }
      await refreshMutations();
      return acked;
    },
    [applyLocalMessage, refreshMutations],
  );

  const editMessage = useCallback(
    async (message: ChatMessage, text: string) => {
      const trimmed = text.replace(/^\s+|\s+$/gu, "");
      if (!trimmed) return;
      const now = new Date().toISOString();
      const optimistic = { ...message, textContent: trimmed, editedAt: now };
      await queueMutation(
        {
          id: mutationKey("edit", message.id),
          kind: "edit",
          messageId: message.id,
          payload: { text: trimmed },
          status: "queued",
          retryCount: 0,
          createdAt: now,
        },
        optimistic,
        message,
      );
    },
    [queueMutation],
  );

  const deleteMessage = useCallback(
    async (message: ChatMessage) => {
      const now = new Date().toISOString();
      const optimistic = tombstoneMessage(message, now);
      await queueMutation(
        {
          id: mutationKey("delete", message.id),
          kind: "delete",
          messageId: message.id,
          payload: {},
          status: "queued",
          retryCount: 0,
          createdAt: now,
        },
        optimistic,
        message,
      );
    },
    [queueMutation],
  );

  const reactToMessage = useCallback(
    async (message: ChatMessage, emoji: string | null) => {
      const now = new Date().toISOString();
      const others = (message.reactions ?? []).filter((item) => item.userId !== userId);
      const nextReactions =
        emoji === null ? others : [...others, { userId, emoji, createdAt: now }];
      const optimistic = {
        ...message,
        reactions: nextReactions.length ? nextReactions : undefined,
      };
      const kind = emoji ? ("reaction-set" as const) : ("reaction-clear" as const);
      await queueMutation(
        {
          id: mutationKey(kind, message.id),
          kind,
          messageId: message.id,
          payload: emoji ? { emoji } : {},
          status: "queued",
          retryCount: 0,
          createdAt: now,
        },
        optimistic,
        message,
      );
    },
    [queueMutation, userId],
  );

  const applyRemoteMessage = useCallback(
    async (messageId: string) => {
      const incoming = await fetchMessageById(messageId);
      if (!incoming) return;
      if (queuedMutationIds.has(incoming.id)) return;
      await applyLocalMessage(incoming);
    },
    [applyLocalMessage, queuedMutationIds],
  );

  const retry = useCallback(
    async (clientGeneratedId: string) => {
      if (
        photoMessages.some(
          (message) =>
            message.clientGeneratedId === clientGeneratedId &&
            message.id === message.clientGeneratedId,
        )
      ) {
        await uploadManager.retry(clientGeneratedId);
        return;
      }
      const db = getChatDb();
      const item = await db.pendingMessages.get(clientGeneratedId);
      if (!item) {
        return;
      }
      await updatePending(clientGeneratedId, { status: "queued", retryCount: 0 });
      const acked = await sendPendingOnce({ ...item, status: "queued", retryCount: 0 });
      if (acked) {
        setMessages((current) =>
          current.some((row) => item.clientGeneratedId === row.clientGeneratedId)
            ? current.map((row) =>
                row.clientGeneratedId === acked.clientGeneratedId ? acked : row,
              )
            : [...current, acked],
        );
      }
      await refreshPending();
    },
    [photoMessages, refreshPending],
  );

  const loadOlder = useCallback(async () => {
    if (!oldestId || !hasMore || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    try {
      const page = await loadOlderIntoCache(conversationId, oldestId);
      setMessages((current) => {
        const seen = new Set(current.map((item) => item.id));
        const prepended = page.messages.filter((item) => !seen.has(item.id));
        return [...prepended, ...current];
      });
      setHasMore(Boolean(page.nextBeforeCursor));
    } catch {
      // Keep current window.
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, oldestId]);

  /**
   * Re-pull the newest page and merge by id.
   *
   * Cursor sync only ever looks forward, so it cannot repair a row that changed
   * after the cursor passed it — a photo whose attachments finalized late, for
   * instance. Reconciliation is the recovery path realtime leans on.
   */
  const reconcileRecent = useCallback(async () => {
    if (historicalModeRef.current) {
      return;
    }
    try {
      const page = await loadRecentIntoCache(conversationId);
      const byId = new Map(page.messages.map((message) => [message.id, message]));
      const blocked = new Set(
        (await listPendingMutations())
          .filter((item) => item.status === "queued" || item.status === "sending")
          .map((item) => item.messageId),
      );
      setMessages((current) => {
        const merged = current.map((message) => {
          if (blocked.has(message.id)) return message;
          const incoming = byId.get(message.id);
          return incoming ? reconcileCachedMessage(message, incoming) : message;
        });
        const known = new Set(current.map((message) => message.clientGeneratedId));
        const extra = page.messages.filter((message) => !known.has(message.clientGeneratedId));
        return extra.length > 0 ? [...merged, ...extra] : merged;
      });
      if (page.newestId) newestIdRef.current = page.newestId;
    } catch {
      // Next poll retries.
    }
  }, [conversationId]);

  const syncNew = useCallback(async () => {
    try {
      const page = await syncAfterCursor(conversationId, newestIdRef.current);
      if (page.messages.length > 0 && !historicalModeRef.current) {
        setMessages((current) => {
          const seen = new Set(current.map((item) => item.clientGeneratedId));
          const extra = page.messages.filter((item) => !seen.has(item.clientGeneratedId));
          return extra.length ? [...current, ...extra] : current;
        });
        newestIdRef.current = page.newestId ?? newestIdRef.current;
      }
      await flushPendingQueue(conversationId);
      await flushPendingMutations();
      await refreshPending();
      await refreshMutations();
      await refreshReceiptsForOutgoing();
    } catch {
      // Reconnect will try again.
    }
  }, [conversationId, refreshMutations, refreshPending, refreshReceiptsForOutgoing]);

  const openAround = useCallback(async (messageId: string) => {
    try {
      const context = await loadAroundIntoCache(messageId);
      setMessages(context.messages);
      setHasMore(Boolean(context.hasMoreOlder));
      setHistoricalMode(true);
      setFocusReady(true);
      setFocusMiss(false);
      return true;
    } catch {
      setFocusMiss(true);
      setFocusReady(true);
      return false;
    }
  }, []);

  /** Leave historical window and restore the newest page (smart ↓ / own-send). */
  const returnToLatest = useCallback(async () => {
    try {
      const page = await loadRecentIntoCache(conversationId);
      setMessages(page.messages);
      setHasMore(Boolean(page.nextBeforeCursor));
      newestIdRef.current = page.newestId ?? newestIdRef.current;
      setHistoricalMode(false);
      queryClient.setQueryData(["chat", conversationId], page);
    } catch {
      // Offline — keep current window.
    }
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (connection === "offline") {
      return;
    }
    const queued = pending.filter((item) => item.status === "queued");
    if (queued.length === 0) {
      return;
    }
    const timers = queued.map((item) =>
      window.setTimeout(() => {
        void sendPendingOnce(item).then((acked) => {
          if (acked) {
            setMessages((current) =>
              current.some((row) => row.clientGeneratedId === acked.clientGeneratedId)
                ? current.map((row) =>
                    row.clientGeneratedId === acked.clientGeneratedId ? acked : row,
                  )
                : [...current, acked],
            );
          }
          void refreshPending();
        });
      }, backoffMs(item.retryCount)),
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [connection, pending, refreshPending]);

  useEffect(() => {
    if (connection === "offline") {
      return;
    }
    const queued = pendingMutations.filter((item) => item.status === "queued");
    if (queued.length === 0) {
      return;
    }
    const timers = queued.map((item) =>
      window.setTimeout(() => {
        void sendMutationOnce(item).then((acked) => {
          if (acked) {
            setMessages((current) => upsertMessage(current, acked));
          }
          void refreshMutations();
        });
      }, backoffMs(item.retryCount)),
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [connection, pendingMutations, refreshMutations]);

  useEffect(() => {
    if (connection === "online" || connection === "poor") {
      void syncNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  return {
    messages: visibleMessages,
    pending,
    hasMore,
    loadingOlder,
    connection,
    draft,
    setDraft: persistDraft,
    send,
    sendSticker,
    sendDoodle,
    sendPhotos,
    sendVideo,
    sendVoice,
    retry,
    loadOlder,
    syncNew,
    reconcileRecent,
    patchReceipts,
    refreshReceiptsForOutgoing,
    historicalMode,
    focusReady,
    focusMiss,
    returnToLatest,
    openAround,
    editMessage,
    deleteMessage,
    reactToMessage,
    applyRemoteMessage,
    mutationError,
    clearMutationError: () => setMutationError(null),
  };
}
