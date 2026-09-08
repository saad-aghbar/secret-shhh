"use client";

import { Phone, Video } from "lucide-react";

import { ShhhIconButton } from "@/components/shhh";
import { useCallSessionOptional } from "@/features/calls/call-session-provider";
import { isLiveCallStatus } from "@/lib/calls/config";

export function ChatCallActions() {
  const session = useCallSessionOptional();
  if (!session) return null;
  const { startCall, call } = session;
  const busy = Boolean(call && isLiveCallStatus(call.status));

  return (
    <div className="flex items-center gap-1">
      <ShhhIconButton
        label="Start audio call"
        data-testid="start-audio-call"
        disabled={busy}
        onClick={() => void startCall("audio")}
      >
        <Phone className="size-5" strokeWidth={2.1} />
      </ShhhIconButton>
      <ShhhIconButton
        label="Start video call"
        data-testid="start-video-call"
        disabled={busy}
        onClick={() => void startCall("video")}
      >
        <Video className="size-5" strokeWidth={2.1} />
      </ShhhIconButton>
    </div>
  );
}
