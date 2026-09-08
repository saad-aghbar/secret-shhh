import type { CallOutcome, CallType } from "@/lib/calls/config";
import { formatCallDurationLabel } from "@/lib/calls/duration";

export type CallEventMeta = {
  callId: string;
  callType: CallType;
  outcome: CallOutcome;
  durationMs: number | null;
};

export function callEventTitle(meta: CallEventMeta): string {
  const kind = meta.callType === "video" ? "Video call" : "Audio call";
  if (meta.outcome === "missed") return `Missed ${kind.toLowerCase()}`;
  if (meta.outcome === "declined") return "Call declined";
  if (meta.outcome === "cancelled") return "No answer";
  if (meta.outcome === "failed") return "Couldn't connect the call.";
  const duration = formatCallDurationLabel(meta.durationMs);
  return duration ? `${kind} · ${duration}` : kind;
}

export function callAgainLabel(type: CallType) {
  return type === "video" ? "Video call again" : "Call again";
}

export function parseCallEventMeta(value: unknown): CallEventMeta | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const callId = typeof record.callId === "string" ? record.callId : null;
  const callType = record.callType === "video" || record.callType === "audio" ? record.callType : null;
  const outcome =
    record.outcome === "completed" ||
    record.outcome === "missed" ||
    record.outcome === "declined" ||
    record.outcome === "cancelled" ||
    record.outcome === "failed"
      ? record.outcome
      : null;
  if (!callId || !callType || !outcome) return null;
  const durationMs = typeof record.durationMs === "number" ? record.durationMs : null;
  return { callId, callType, outcome, durationMs };
}
