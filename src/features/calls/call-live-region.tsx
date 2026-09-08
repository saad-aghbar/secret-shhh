"use client";

import { useEffect, useRef, useState } from "react";

import { useCallSession } from "@/features/calls/call-session-provider";
import { callAnnouncement } from "@/lib/calls/announce";
import { isLiveCallStatus } from "@/lib/calls/config";

export function CallLiveRegion() {
  const session = useCallSession();
  const [text, setText] = useState("");
  const hadCall = useRef(false);

  useEffect(() => {
    const live = Boolean(session.call && isLiveCallStatus(session.call.status));
    const next = callAnnouncement({
      hadCall: hadCall.current,
      call: session.call,
      partnerName: session.partnerName,
      network: session.network,
      videoUpgradeNote: session.showVideoUpgradeNote,
    });
    hadCall.current = live;
    if (next) setText(next);
  }, [session.call, session.network, session.partnerName, session.showVideoUpgradeNote]);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="call-live-region">
      {text}
    </div>
  );
}
