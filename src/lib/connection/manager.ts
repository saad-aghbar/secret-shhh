export type ConnectionState = "online" | "poor" | "reconnecting" | "offline";

type Listener = (state: ConnectionState) => void;

const SLOW_MS = 4_000;

/**
 * Central connection state. navigator.onLine is a hint, not the source of truth —
 * actual fetch/realtime failures drive reconnecting / offline.
 */
class ConnectionManager {
  private state: ConnectionState = "online";
  private listeners = new Set<Listener>();
  private bound = false;

  getState() {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.bindBrowser();
    return () => {
      this.listeners.delete(listener);
    };
  }

  reportSuccess(durationMs?: number) {
    if (typeof durationMs === "number" && durationMs >= SLOW_MS && this.browserOnline()) {
      this.set("poor");
      return;
    }
    this.set(this.browserOnline() ? "online" : "offline");
  }

  reportFailure() {
    if (!this.browserOnline()) {
      this.set("offline");
      return;
    }
    this.set("reconnecting");
  }

  reportRealtime(connected: boolean) {
    if (!this.browserOnline()) {
      this.set("offline");
      return;
    }
    if (connected) {
      if (this.state !== "poor") {
        this.set("online");
      }
      return;
    }
    this.set("reconnecting");
  }

  private browserOnline() {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  }

  private bindBrowser() {
    if (this.bound || typeof window === "undefined") {
      return;
    }
    this.bound = true;
    window.addEventListener("online", () => {
      this.set("online");
    });
    window.addEventListener("offline", () => {
      this.set("offline");
    });
    if (!navigator.onLine) {
      this.set("offline");
    }
  }

  private set(next: ConnectionState) {
    if (this.state === next) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }
}

export const connectionManager = new ConnectionManager();
