import { isCanonicalProductionUrl } from "@/lib/env/runtime";

const REQUIRED_PRODUCTION_NAMES = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "AUTHORIZED_USER_1_PIN_HASH",
  "AUTHORIZED_USER_2_PIN_HASH",
  "NEXT_PUBLIC_APP_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const;

export type EnvMap = Record<string, string | undefined>;

export function missingProductionEnvNames(env: EnvMap = process.env): string[] {
  return REQUIRED_PRODUCTION_NAMES.filter((name) => !env[name]?.trim());
}

/**
 * Fail deployed production startup if critical env is missing or unsafe.
 * Error text lists variable names only — never values.
 */
export function assertProductionEnv(env: EnvMap = process.env) {
  if (env.VERCEL_ENV !== "production") return;

  const missing = missingProductionEnvNames(env);
  if (missing.length) {
    throw new Error(
      `Production environment is incomplete. Set: ${missing.join(", ")}.`,
    );
  }

  if (!isCanonicalProductionUrl(env.NEXT_PUBLIC_APP_URL)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a public https URL in production (not localhost or http).",
    );
  }

  const livekit = env.LIVEKIT_URL ?? "";
  if (!livekit.startsWith("wss://")) {
    throw new Error("LIVEKIT_URL must be a wss:// LiveKit Cloud URL in production.");
  }

  if (env.E2E_FORCE_CHAT_FAIL === "1") {
    throw new Error("E2E_FORCE_CHAT_FAIL cannot be enabled in production.");
  }

  if (env.STORAGE_PROVIDER === "test") {
    throw new Error("STORAGE_PROVIDER=test is not allowed in production.");
  }
}
