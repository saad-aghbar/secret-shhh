import {
  isLiveCallStatus,
  type CallNetworkStatus,
  type CallRole,
  type CallStatus,
  type CallType,
} from "@/lib/calls/config";

export function callAnnouncement(input: {
  hadCall: boolean;
  call: { status: CallStatus; type: CallType; role: CallRole } | null;
  partnerName: string;
  network: CallNetworkStatus;
  videoUpgradeNote?: boolean;
}): string {
  if (!input.call || !isLiveCallStatus(input.call.status)) {
    return input.hadCall ? "Call ended" : "";
  }
  if (input.videoUpgradeNote) {
    return `${input.partnerName} turned on video`;
  }
  if (input.call.status === "ringing" && input.call.role === "callee") {
    return input.call.type === "video"
      ? `Incoming video call from ${input.partnerName}`
      : `Incoming call from ${input.partnerName}`;
  }
  if (input.network === "reconnecting" || input.call.status === "reconnecting") {
    return "Reconnecting";
  }
  if (input.network === "weak") return "Connection is weak";
  if (input.call.status === "connected") return "Call connected";
  return "";
}
