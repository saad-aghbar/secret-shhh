import type { CallType, CallView } from "@/lib/calls/config";

export type { CallType, CallView };

async function parseCall(response: Response): Promise<CallView> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Couldn't connect the call.");
  }
  return (await response.json()) as CallView;
}

export type ActiveCallPayload = {
  call: CallView | null;
  partnerName: string;
  conversationId: string;
};

export async function apiGetActiveCall(): Promise<ActiveCallPayload> {
  const response = await fetch("/api/calls", { cache: "no-store" });
  if (response.status === 401) throw new Error("Couldn't load the call.");
  if (!response.ok) throw new Error("Couldn't load the call.");
  const body = (await response.json()) as Partial<ActiveCallPayload>;
  return {
    call: body.call ?? null,
    partnerName: body.partnerName ?? "your person",
    conversationId: body.conversationId ?? "",
  };
}

export async function apiGetCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}`, { cache: "no-store" }));
}

export async function apiStartCall(type: CallType) {
  return parseCall(
    await fetch("/api/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    }),
  );
}

export async function apiAcceptCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}/accept`, { method: "POST" }));
}

export async function apiDeclineCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}/decline`, { method: "POST" }));
}

export async function apiCancelCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}/cancel`, { method: "POST" }));
}

export async function apiEndCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}/end`, { method: "POST" }));
}

export async function apiUpgradeCall(callId: string) {
  return parseCall(await fetch(`/api/calls/${callId}/upgrade`, { method: "POST" }));
}

export async function apiCallToken(callId: string) {
  const response = await fetch(`/api/calls/${callId}/token`, { method: "POST" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Couldn't connect the call.");
  }
  return (await response.json()) as { url: string; token: string };
}

export async function apiMarkCallState(
  callId: string,
  action: "connected" | "reconnecting" | "failed",
) {
  return parseCall(
    await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }),
  );
}
