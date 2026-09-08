import { AccessToken } from "livekit-server-sdk";

import type { CallRecord } from "@/lib/calls/config";
import { CALL_TOKEN_TTL, isLiveCallStatus } from "@/lib/calls/config";
import { CallError } from "@/lib/calls/errors";
import { getLiveKitEnv } from "@/lib/livekit/env";

export function isLiveKitConfigured() {
  const env = getLiveKitEnv();
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

export function requireLiveKitEnv() {
  const env = getLiveKitEnv();
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new CallError("UNAVAILABLE", "Couldn't connect the call.", 503);
  }
  return {
    url: env.LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  };
}

export function assertCanMintCallToken(call: CallRecord, userId: string) {
  if (userId !== call.callerId && userId !== call.calleeId) {
    throw new CallError("FORBIDDEN", "You can’t join this call.", 403);
  }
  if (!isLiveCallStatus(call.status)) {
    throw new CallError("CONFLICT", "That call has already ended.", 409);
  }
}

export async function mintCallToken(params: {
  call: CallRecord;
  userId: string;
  displayName: string;
}) {
  assertCanMintCallToken(params.call, params.userId);

  const env = requireLiveKitEnv();
  const token = new AccessToken(env.apiKey, env.apiSecret, {
    identity: params.userId,
    name: params.displayName,
    ttl: CALL_TOKEN_TTL,
  });
  token.addGrant({
    roomJoin: true,
    room: params.call.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    roomCreate: false,
    roomAdmin: false,
    roomList: false,
  });
  return {
    url: env.url,
    token: await token.toJwt(),
  };
}
