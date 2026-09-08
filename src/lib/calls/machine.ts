import {
  type CallEndReason,
  type CallOutcome,
  type CallStatus,
  isLiveCallStatus,
  isTerminalCallStatus,
  normalizeCallStatus,
  outcomeFromStatus,
} from "@/lib/calls/config";

export type CallAction =
  | "create"
  | "accept"
  | "decline"
  | "cancel"
  | "connect"
  | "reconnect"
  | "recovered"
  | "upgrade"
  | "end"
  | "timeout"
  | "fail";

const TRANSITIONS: Record<CallAction, readonly CallStatus[]> = {
  create: ["ringing"],
  accept: ["ringing"],
  decline: ["ringing"],
  cancel: ["ringing"],
  connect: ["connecting", "reconnecting"],
  reconnect: ["connecting", "connected"],
  recovered: ["reconnecting"],
  upgrade: ["connecting", "connected", "reconnecting"],
  end: ["ringing", "connecting", "connected", "reconnecting"],
  timeout: ["ringing"],
  fail: ["ringing", "connecting", "connected", "reconnecting"],
};

export function canTransition(status: CallStatus, action: CallAction): boolean {
  const current = normalizeCallStatus(status);
  if (isTerminalCallStatus(current) && action !== "create") {
    return false;
  }
  return TRANSITIONS[action].includes(current);
}

export function nextStatus(status: CallStatus, action: CallAction): CallStatus | null {
  const current = normalizeCallStatus(status);
  if (!canTransition(current, action)) return null;
  switch (action) {
    case "create":
      return "ringing";
    case "accept":
      return "connecting";
    case "decline":
      return "declined";
    case "cancel":
      return "cancelled";
    case "connect":
    case "recovered":
      return "connected";
    case "reconnect":
      return "reconnecting";
    case "upgrade":
      return current;
    case "timeout":
      return "missed";
    case "fail":
      return "failed";
    case "end":
      return current === "ringing" ? "cancelled" : "completed";
    default:
      return null;
  }
}

export function endReasonFor(action: CallAction, status: CallStatus): CallEndReason {
  if (action === "timeout") return "timeout";
  if (action === "decline") return "declined";
  if (action === "cancel" || (action === "end" && normalizeCallStatus(status) === "ringing")) {
    return "cancelled";
  }
  if (action === "fail") return "failed";
  return "hangup";
}

export function outcomeForAction(action: CallAction, status: CallStatus): CallOutcome {
  const next = nextStatus(status, action);
  return outcomeFromStatus(next ?? status);
}

export function assertLive(status: CallStatus) {
  return isLiveCallStatus(normalizeCallStatus(status));
}
