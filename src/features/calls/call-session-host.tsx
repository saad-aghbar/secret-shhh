"use client";

import type { ReactNode } from "react";

import { ActiveCallPill } from "@/features/calls/active-call-pill";
import { CallLiveRegion } from "@/features/calls/call-live-region";
import { CallSessionProvider } from "@/features/calls/call-session-provider";
import { CallSurface } from "@/features/calls/call-surface";
import { ChatQueryProvider } from "@/features/chat/query-provider";
import { MusicPlayerHost } from "@/features/music/music-player-host";
import { MusicPlayerBridges } from "@/features/music/music-player-provider";

export function CallSessionHost({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <CallSessionProvider>
      {children}
      <CallLiveRegion />
      <CallSurface />
      <ActiveCallPill />
      <ChatQueryProvider>
        <MusicPlayerHost />
      </ChatQueryProvider>
      <MusicPlayerBridges />
    </CallSessionProvider>
  );
}
