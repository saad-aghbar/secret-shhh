export const CALL_RING_TIMEOUT_MS = 40_000;
export const CALL_START_WINDOW_MS = 2 * 60_000;
export const CALL_START_MAX = 40;
export const CALL_ACTIVE_POLL_MS = 2_500;
export const CALL_STALE_CONNECTING_MS = 90_000;
export const CALL_STALE_CONNECTED_MS = 6 * 60 * 60_000;
export const CALL_RECONNECT_GIVE_UP_MS = 45_000;
export const CALL_TOKEN_TTL = "15m";
export const CALL_BROADCAST_CHANNEL = "shhh.call";

export const LIVE_CALL_STATUSES = [
  "ringing",
  "connecting",
  "connected",
  "reconnecting",
] as const;

export const TERMINAL_CALL_STATUSES = [
  "completed",
  "missed",
  "declined",
  "cancelled",
  "failed",
  "ended",
  "rejected",
] as const;

export type CallType = "audio" | "video";
export type CallStatus =
  | (typeof LIVE_CALL_STATUSES)[number]
  | (typeof TERMINAL_CALL_STATUSES)[number];

export type CallOutcome = "completed" | "missed" | "declined" | "cancelled" | "failed";

export type CallEndReason =
  | "hangup"
  | "timeout"
  | "declined"
  | "cancelled"
  | "failed"
  | "reconnect_failed"
  | "permission";

export type CallNetworkStatus = "good" | "weak" | "reconnecting";
export type CallRole = "caller" | "callee";

export type CallRecord = {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  roomName: string;
  status: CallStatus;
  createdAt: string;
  ringingAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endReason: string | null;
  durationMs: number | null;
  videoUpgradedBy: string | null;
};

export type CallView = CallRecord & {
  role: CallRole;
};

export function isLiveCallStatus(status: CallStatus): boolean {
  return (LIVE_CALL_STATUSES as readonly string[]).includes(status);
}

export function isTerminalCallStatus(status: CallStatus): boolean {
  return (TERMINAL_CALL_STATUSES as readonly string[]).includes(status);
}

export function normalizeCallStatus(status: string): CallStatus {
  if (status === "rejected") return "declined";
  if (status === "ended") return "completed";
  if ((LIVE_CALL_STATUSES as readonly string[]).includes(status)) {
    return status as CallStatus;
  }
  if ((TERMINAL_CALL_STATUSES as readonly string[]).includes(status)) {
    return status as CallStatus;
  }
  return "failed";
}

export function outcomeFromStatus(status: CallStatus): CallOutcome {
  const normalized = normalizeCallStatus(status);
  if (normalized === "missed") return "missed";
  if (normalized === "declined") return "declined";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "failed") return "failed";
  return "completed";
}
