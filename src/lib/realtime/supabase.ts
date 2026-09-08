import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/public-env";

export function isRealtimeConfigured() {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

let browserClient: SupabaseClient | null = null;

export function createRealtimeClient(): SupabaseClient | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }

  // One client per tab. Several hooks subscribe to the same conversation
  // channel, and separate clients would open redundant sockets and warn.
  if (typeof window !== "undefined") {
    browserClient ??= createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return browserClient;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function conversationChannelName(conversationId: string) {
  return `conversation:${conversationId}`;
}
