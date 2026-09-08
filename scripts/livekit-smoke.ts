/**
 * Real LiveKit Cloud smoke.
 *
 * Mints a short-lived room token and authenticates against the project
 * with RoomServiceClient. Never prints secrets or tokens.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function applyEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  applyEnvLocal();
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    console.error("REAL LIVEKIT ACCEPTANCE BLOCKED — missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET.");
    process.exit(2);
  }
  if (!url.startsWith("wss://") && !url.includes("localhost")) {
    console.error("LIVEKIT_URL should be a wss:// LiveKit Cloud URL.");
    process.exit(1);
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: "shhh-smoke",
    ttl: "60s",
  });
  token.addGrant({
    roomJoin: true,
    room: "shhh-call-smoke",
    canPublish: true,
    canSubscribe: true,
    roomCreate: false,
    roomAdmin: false,
  });
  const jwt = await token.toJwt();
  if (!jwt || jwt.length < 20) {
    console.error("LiveKit token mint failed.");
    process.exit(1);
  }
  console.log("LiveKit token mint succeeded (token not printed).");

  const host = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const rooms = new RoomServiceClient(host, apiKey, apiSecret);
  await rooms.listRooms();
  console.log("LiveKit Cloud authenticated (RoomService listRooms ok).");
}

void main().catch((error) => {
  const name = error instanceof Error ? error.name : "Error";
  console.error(`LiveKit Cloud smoke failed (${name}).`);
  process.exit(1);
});
