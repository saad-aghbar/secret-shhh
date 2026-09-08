const KEY = "shhh.call.tabOwner";

export function claimCallTab(callId: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, callId);
}

export function ownsCallTab(callId: string) {
  if (typeof sessionStorage === "undefined") return true;
  return sessionStorage.getItem(KEY) === callId;
}

export function clearCallTab(callId?: string) {
  if (typeof sessionStorage === "undefined") return;
  const current = sessionStorage.getItem(KEY);
  if (!callId || current === callId) {
    sessionStorage.removeItem(KEY);
  }
}
