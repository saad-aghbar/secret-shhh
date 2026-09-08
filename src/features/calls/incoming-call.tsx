"use client";

import { CallIdentity } from "@/features/calls/call-identity";
import { IncomingCallControls } from "@/features/calls/call-controls";
import type { CallType } from "@/lib/calls/config";

export function IncomingCall(props: {
  partnerName: string;
  type: CallType;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between py-10" data-testid="incoming-call">
      <CallIdentity
        name={props.partnerName}
        status={props.type === "video" ? "Incoming video call" : "Incoming call"}
        breathing
      />
      <IncomingCallControls
        video={props.type === "video"}
        onAccept={props.onAccept}
        onDecline={props.onDecline}
      />
    </div>
  );
}
