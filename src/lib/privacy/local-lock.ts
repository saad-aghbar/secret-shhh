const LOCK_FLAG_KEY = "shhh.lock.local";
const HIDDEN_AT_KEY = "shhh.hiddenAt";
const CONVERSATION_KEY_PREFIX = "shhh.offline.conversation.";

export function writeLocalLockFlag(locked: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (locked) {
      window.localStorage.setItem(LOCK_FLAG_KEY, "1");
    } else {
      window.localStorage.removeItem(LOCK_FLAG_KEY);
      window.localStorage.removeItem(HIDDEN_AT_KEY);
    }
  } catch {
    // Storage can be full or blocked — lock UI still works from React state.
  }
}

export function readLocalLockFlag() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCK_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLocalHiddenAt(atMs: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HIDDEN_AT_KEY, String(atMs));
  } catch {
    // ignore
  }
}

export function clearLocalHiddenAt() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HIDDEN_AT_KEY);
  } catch {
    // ignore
  }
}

export function readLocalHiddenAt() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HIDDEN_AT_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberOfflineConversation(userId: string, conversationId: string) {
  if (typeof window === "undefined" || !userId || !conversationId) return;
  try {
    window.localStorage.setItem(`${CONVERSATION_KEY_PREFIX}${userId}`, conversationId);
  } catch {
    // ignore
  }
}

export function readOfflineConversation(userId?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    if (userId) {
      return window.localStorage.getItem(`${CONVERSATION_KEY_PREFIX}${userId}`);
    }
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(CONVERSATION_KEY_PREFIX),
    );
    if (keys.length !== 1) return null;
    return window.localStorage.getItem(keys[0] ?? "");
  } catch {
    return null;
  }
}

export function clearOfflineConversation(userId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.removeItem(`${CONVERSATION_KEY_PREFIX}${userId}`);
      return;
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(CONVERSATION_KEY_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function clearPrivacyLocalState() {
  writeLocalLockFlag(false);
  clearOfflineConversation();
}
