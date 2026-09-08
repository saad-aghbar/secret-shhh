"use client";

import { CallIdentity } from "@/features/calls/call-identity";
import { EndCallButton } from "@/features/calls/call-controls";
import type { CallType } from "@/lib/calls/config";

export function OutgoingCall(props: {
  partnerName: string;
  type: CallType;
  onCancel: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between py-10" data-testid="outgoing-call">
      <CallIdentity
        name={props.partnerName}
        status={props.type === "video" ? "Video calling…" : "Calling…"}
        breathing
      />
      <EndCallButton label="Cancel call" testId="cancel-call" onClick={props.onCancel} />
    </div>
  );
}
