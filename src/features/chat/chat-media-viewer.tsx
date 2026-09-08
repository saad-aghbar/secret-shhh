"use client";

import { useEffect, useState } from "react";

import { PhotoViewer } from "@/features/chat/photo-viewer";
import type { ChatMediaItem } from "@/lib/chat/types";

type OpenRequest = {
  media: ChatMediaItem[];
  initialIndex: number;
  senderName: string;
  caption?: string;
};

type Listener = (request: OpenRequest) => void;
const listeners = new Set<Listener>();

/**
 * Chat rows are virtualized. Viewer state must live outside the row so
 * scrolling cannot unmount an open player.
 */
export function openChatMediaViewer(request: OpenRequest) {
  for (const listener of listeners) listener(request);
}

export function ChatMediaViewerHost() {
  const [open, setOpen] = useState<OpenRequest | null>(null);

  useEffect(() => {
    const listener: Listener = (request) => setOpen(request);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <PhotoViewer
      key={open ? `${open.media.map((item) => item.id).join(",")}:${open.initialIndex}` : "closed"}
      open={Boolean(open)}
      media={open?.media ?? []}
      initialIndex={open?.initialIndex ?? 0}
      senderName={open?.senderName}
      caption={open?.caption}
      onClose={() => setOpen(null)}
    />
  );
}
