import type { ConversationEvent } from "@/lib/realtime/broadcast";

type RealtimeTestEvent = ConversationEvent;

type Listener = (event: RealtimeTestEvent, payload: Record<string, unknown>) => void;

/**
 * In-browser bus for Playwright / local demos without Supabase.
 * Production Realtime uses Supabase; this never replaces server authority.
 */
class RealtimeTestBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(conversationId: string, listener: Listener) {
    const set = this.listeners.get(conversationId) ?? new Set();
    set.add(listener);
    this.listeners.set(conversationId, set);
    return () => {
      set.delete(listener);
    };
  }

  hasListeners(conversationId: string) {
    return (this.listeners.get(conversationId)?.size ?? 0) > 0;
  }

  publish(conversationId: string, event: RealtimeTestEvent, payload: Record<string, unknown> = {}) {
    const set = this.listeners.get(conversationId);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(event, payload);
    }
  }
}

declare global {
  interface Window {
    __shhhRealtimeTestBus?: RealtimeTestBus;
  }
}

export function getRealtimeTestBus() {
  if (typeof window === "undefined") {
    return new RealtimeTestBus();
  }
  window.__shhhRealtimeTestBus ??= new RealtimeTestBus();
  return window.__shhhRealtimeTestBus;
}
