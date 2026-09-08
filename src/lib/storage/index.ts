import { isDeployedProduction } from "@/lib/env/runtime";
import { getServerEnv } from "@/lib/env";
import type { StorageProvider } from "@/lib/storage/provider";
import { createR2StorageProvider } from "@/lib/storage/r2";
import { createTestStorageProvider } from "@/lib/storage/test-provider";

let cached: StorageProvider | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT,
  );
}

export function getStorageProviderName(): "r2" | "test" {
  if (isDeployedProduction()) return "r2";
  if (process.env.STORAGE_PROVIDER === "test") return "test";
  if (process.env.STORAGE_PROVIDER === "r2") return "r2";
  return isR2Configured() ? "r2" : "test";
}

/**
 * Production uses R2 when credentials exist.
 * CI / local without R2 uses the in-memory test provider (never claim Phase 4 complete on test alone).
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const name = getStorageProviderName();
  if (name === "r2") {
    if (!isR2Configured()) {
      throw new Error("R2 credentials are required when STORAGE_PROVIDER=r2");
    }
    cached = createR2StorageProvider({
      accountId: process.env.R2_ACCOUNT_ID!,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucket: process.env.R2_BUCKET!,
      endpoint: process.env.R2_ENDPOINT!,
    });
  } else {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    cached = createTestStorageProvider(baseUrl);
  }

  return cached;
}

export function resetStorageProviderCache() {
  cached = null;
}

export function maxImageBytes() {
  return getServerEnv().MAX_IMAGE_BYTES;
}

export function maxVideoBytes() {
  return getServerEnv().MAX_VIDEO_BYTES;
}

export function maxAudioBytes() {
  return getServerEnv().MAX_AUDIO_BYTES;
}
