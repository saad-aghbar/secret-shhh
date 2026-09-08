"use client";

import { useEffect, useState } from "react";

import { DoodleViewer } from "@/features/doodles/doodle-viewer";
import type { DoodleRef } from "@/lib/chat/types";

type OpenRequest = {
  doodle: DoodleRef;
  senderName: string;
  timestamp?: string;
};

type Listener = (request: OpenRequest) => void;
const listeners = new Set<Listener>();

export function openDoodleViewer(request: OpenRequest) {
  for (const listener of listeners) listener(request);
}

export function ChatDoodleViewerHost() {
  const [open, setOpen] = useState<OpenRequest | null>(null);

  useEffect(() => {
    const listener: Listener = (request) => setOpen(request);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <DoodleViewer
      open={Boolean(open)}
      doodle={open?.doodle ?? null}
      senderName={open?.senderName}
      timestamp={open?.timestamp}
      onClose={() => setOpen(null)}
    />
  );
}
