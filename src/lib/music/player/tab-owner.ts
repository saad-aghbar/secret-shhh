const CHANNEL = "shhh.music";
const STORAGE_KEY = "shhh.music.tabOwner";

export function musicTabId() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") return "tab";
  const existing = sessionStorage.getItem("shhh.music.tabId");
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem("shhh.music.tabId", id);
  return id;
}

export function claimMusicTab() {
  if (typeof sessionStorage === "undefined") return musicTabId();
  const id = musicTabId();
  sessionStorage.setItem(STORAGE_KEY, id);
  return id;
}

export function ownsMusicTab() {
  if (typeof sessionStorage === "undefined") return true;
  const id = sessionStorage.getItem("shhh.music.tabId");
  const owner = sessionStorage.getItem(STORAGE_KEY);
  return !owner || owner === id;
}

export function publishMusicClaim(tabId: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ kind: "claimed", tabId });
  channel.close();
}

export function subscribeMusicClaims(onClaim: (tabId: string) => void) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<{ kind?: string; tabId?: string }>) => {
    if (event.data?.kind === "claimed" && event.data.tabId) {
      onClaim(event.data.tabId);
    }
  };
  return () => channel.close();
}
