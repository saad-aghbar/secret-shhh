"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { connectionManager } from "@/lib/connection/manager";
import {
  conversationChannelName,
  createRealtimeClient,
  isRealtimeConfigured,
} from "@/lib/realtime/supabase";
import type { ReceiptPatch } from "@/lib/sync/merge";
import { getRealtimeTestBus } from "@/lib/realtime/test-bus";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ReceiptPayload = {
  kind?: string;
  messageIds?: string[] | string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

type UseChatRealtimeArgs = {
  conversationId: string;
  userId: string;
  onMessage: () => void;
  onReceipt: (patches: ReceiptPatch[]) => void;
  onTyping: (active: boolean) => void;
  /** A photo finished uploading: cursor sync can miss it, so reconcile instead. */
  onMediaChanged?: () => void;
  onMessageMutated?: (messageId: string) => void;
};

function normalizeMessageIds(raw: ReceiptPayload["messageIds"]): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string");
  }
  if (typeof raw === "string" && raw.length > 0) {
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function patchesFromPayload(payload: ReceiptPayload): ReceiptPatch[] {
  return normalizeMessageIds(payload.messageIds).map((messageId) => ({
    messageId,
    deliveredAt: payload.deliveredAt,
    readAt: payload.readAt,
  }));
}

/**
 * Realtime is notification-only. When Supabase env is missing, callers
 * poll syncAfterCursor (see ChatExperience). Test bus enables Playwright
 * without live Supabase. Typing shares the same subscribed channel.
 */
function mutatedMessageId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "messageId" in payload) {
    const id = (payload as { messageId?: unknown }).messageId;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function useChatRealtime({
  conversationId,
  userId,
  onMessage,
  onReceipt,
  onTyping,
  onMediaChanged,
  onMessageMutated,
}: UseChatRealtimeArgs) {
  const handlers = useRef({ onMessage, onReceipt, onTyping, onMediaChanged, onMessageMutated });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const [realtimeSubscribed, setRealtimeSubscribed] = useState(false);
  const lastTypingSent = useRef(0);
  const typingStopTimer = useRef<number | null>(null);

  useEffect(() => {
    handlers.current = { onMessage, onReceipt, onTyping, onMediaChanged, onMessageMutated };
  }, [onMediaChanged, onMessage, onMessageMutated, onReceipt, onTyping]);

  useEffect(() => {
    const bus = getRealtimeTestBus();
    return bus.subscribe(conversationId, (event, payload) => {
      if (event === "message:new") {
        handlers.current.onMessage();
      }
      if (event === "receipt:update") {
        handlers.current.onReceipt(patchesFromPayload(payload as ReceiptPayload));
      }
      if (event === "media:changed") {
        handlers.current.onMediaChanged?.();
      }
      if (event === "message:edited" || event === "message:deleted" || event === "reaction:changed") {
        const id = mutatedMessageId(payload);
        if (id) handlers.current.onMessageMutated?.(id);
      }
      if (event === "typing:start") {
        const id = (payload as { userId?: string }).userId;
        if (id && id !== userId) {
          handlers.current.onTyping(true);
        }
      }
      if (event === "typing:stop") {
        const id = (payload as { userId?: string }).userId;
        if (id && id !== userId) {
          handlers.current.onTyping(false);
        }
      }
    });
  }, [conversationId, userId]);

  useEffect(() => {
    if (!isRealtimeConfigured()) {
      connectionManager.reportRealtime(false);
      return;
    }

    const client = createRealtimeClient();
    if (!client) {
      return;
    }

    const channel = client.channel(conversationChannelName(conversationId), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;

    channel
      .on("broadcast", { event: "message:new" }, () => {
        handlers.current.onMessage();
      })
      .on("broadcast", { event: "receipt:update" }, ({ payload }) => {
        handlers.current.onReceipt(patchesFromPayload((payload ?? {}) as ReceiptPayload));
      })
      .on("broadcast", { event: "media:changed" }, () => {
        handlers.current.onMediaChanged?.();
      })
      .on("broadcast", { event: "message:edited" }, ({ payload }) => {
        const id = mutatedMessageId(payload);
        if (id) handlers.current.onMessageMutated?.(id);
      })
      .on("broadcast", { event: "message:deleted" }, ({ payload }) => {
        const id = mutatedMessageId(payload);
        if (id) handlers.current.onMessageMutated?.(id);
      })
      .on("broadcast", { event: "reaction:changed" }, ({ payload }) => {
        const id = mutatedMessageId(payload);
        if (id) handlers.current.onMessageMutated?.(id);
      })
      .on("broadcast", { event: "typing:start" }, ({ payload }) => {
        if (payload && typeof payload === "object" && "userId" in payload) {
          if ((payload as { userId?: string }).userId !== userId) {
            handlers.current.onTyping(true);
          }
        }
      })
      .on("broadcast", { event: "typing:stop" }, ({ payload }) => {
        if (payload && typeof payload === "object" && "userId" in payload) {
          if ((payload as { userId?: string }).userId !== userId) {
            handlers.current.onTyping(false);
          }
        }
      })
      .subscribe((status) => {
        const ok = status === "SUBSCRIBED";
        subscribedRef.current = ok;
        setRealtimeSubscribed(ok);
        connectionManager.reportRealtime(ok);
      });

    return () => {
      if (typingStopTimer.current) {
        window.clearTimeout(typingStopTimer.current);
      }
      subscribedRef.current = false;
      setRealtimeSubscribed(false);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [conversationId, userId]);

  const publishTyping = useCallback(
    (active: boolean) => {
      const bus = getRealtimeTestBus();
      const channel = channelRef.current;

      const emit = (event: "typing:start" | "typing:stop") => {
        bus.publish(conversationId, event, { userId });
        if (channel && subscribedRef.current) {
          void channel.send({
            type: "broadcast",
            event,
            payload: { userId },
          });
        }
      };

      if (typingStopTimer.current) {
        window.clearTimeout(typingStopTimer.current);
        typingStopTimer.current = null;
      }
      if (!active) {
        emit("typing:stop");
        lastTypingSent.current = 0;
        return;
      }
      if (!subscribedRef.current) {
        // Realtime configured but not subscribed yet — skip (no false local-only typing).
        if (isRealtimeConfigured()) {
          return;
        }
        if (!bus.hasListeners(conversationId)) {
          return;
        }
      }
      const now = Date.now();
      if (now - lastTypingSent.current > 1_500) {
        lastTypingSent.current = now;
        emit("typing:start");
      }
      typingStopTimer.current = window.setTimeout(() => {
        emit("typing:stop");
        lastTypingSent.current = 0;
      }, 3_000);
    },
    [conversationId, userId],
  );

  return { publishTyping, realtimeSubscribed };
}

/** Standalone typing publisher (tests). Production chat uses publishTyping from useChatRealtime. */
export function useTypingPublisher(conversationId: string, userId: string) {
  const lastSent = useRef(0);
  const stopTimer = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!isRealtimeConfigured()) {
      return;
    }
    const client = createRealtimeClient();
    if (!client) {
      return;
    }
    const channel = client.channel(conversationChannelName(conversationId), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel.subscribe((status) => {
      subscribedRef.current = status === "SUBSCRIBED";
    });
    return () => {
      if (stopTimer.current) {
        window.clearTimeout(stopTimer.current);
      }
      subscribedRef.current = false;
      void client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId]);

  return (active: boolean) => {
    const bus = getRealtimeTestBus();
    const channel = channelRef.current;
    const emit = (event: "typing:start" | "typing:stop") => {
      bus.publish(conversationId, event, { userId });
      if (channel && subscribedRef.current) {
        void channel.send({
          type: "broadcast",
          event,
          payload: { userId },
        });
      }
    };
    if (stopTimer.current) {
      window.clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    if (!active) {
      emit("typing:stop");
      return;
    }
    if (!subscribedRef.current && !bus.hasListeners(conversationId)) {
      return;
    }
    const now = Date.now();
    if (now - lastSent.current > 1_500) {
      lastSent.current = now;
      emit("typing:start");
    }
    stopTimer.current = window.setTimeout(() => {
      emit("typing:stop");
    }, 3_000);
  };
}
