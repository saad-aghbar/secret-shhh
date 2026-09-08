"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { mediaKeys } from "@/features/media/query-keys";
import type { ConversationEvent } from "@/lib/realtime/broadcast";
import { useConversationBroadcast } from "@/lib/realtime/use-conversation-broadcast";

const MEDIA_EVENTS = [
  "media:changed",
  "album:changed",
  "favorite:changed",
  "message:new",
] as const satisfies readonly ConversationEvent[];

/**
 * Partner-side convergence for the media library. Events carry ids only;
 * every one of them resolves to an HTTP refetch, which stays the source of
 * truth after a reconnect or a missed broadcast.
 */
export function useMediaRealtime(conversationId: string) {
  const queryClient = useQueryClient();

  const onEvent = useCallback(
    (event: ConversationEvent) => {
      if (event === "album:changed") {
        void queryClient.invalidateQueries({ queryKey: ["media", "albums"] });
        void queryClient.invalidateQueries({ queryKey: ["media", "album"] });
        return;
      }
      if (event === "favorite:changed") {
        void queryClient.invalidateQueries({ queryKey: ["media", "shared"] });
        void queryClient.invalidateQueries({ queryKey: ["media", "album"] });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
    [queryClient],
  );

  useConversationBroadcast({ conversationId, events: MEDIA_EVENTS, onEvent });
}
