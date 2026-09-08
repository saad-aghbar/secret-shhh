import { z } from "zod";

import { parsePublicEnv, publicEnv, type PublicEnv } from "@/lib/public-env";

export { parsePublicEnv, publicEnv, type PublicEnv };

/**
 * Environment validation.
 * Public values are validated eagerly.
 * Server secrets are validated lazily so `pnpm build` works without live credentials.
 *
 * PIN hashes must be stored as `base64:...` because Next.js env loading expands `$`
 * and would corrupt raw Argon2id PHC strings.
 */

function decodeEnvSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("base64:")) {
    return Buffer.from(trimmed.slice("base64:".length), "base64").toString("utf8");
  }
  return trimmed;
}

const pinHashSchema = z
  .string()
  .min(20)
  .transform(decodeEnvSecret)
  .refine((value) => value.includes("argon2"), {
    message: "PIN hash must be a valid Argon2 hash (prefer base64:… encoding in .env)",
  });

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTHORIZED_USER_1_DISPLAY_NAME: z.string().min(1).default("Saad"),
  AUTHORIZED_USER_2_DISPLAY_NAME: z.string().min(1).default("Tala"),
  AUTHORIZED_USER_1_PIN_HASH: pinHashSchema,
  AUTHORIZED_USER_2_PIN_HASH: pinHashSchema,
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  AUTH_PIN_MIN_LENGTH: z.coerce.number().int().min(4).max(12).default(6),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(30),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(52_428_800),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(2_147_483_648),
  MAX_AUDIO_BYTES: z.coerce.number().int().positive().default(52_428_800),
  MESSAGE_TEXT_MAX_LENGTH: z.coerce.number().int().min(500).max(20_000).default(8_000),
  YOUTUBE_API_KEY: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTHORIZED_USER_1_DISPLAY_NAME: process.env.AUTHORIZED_USER_1_DISPLAY_NAME,
    AUTHORIZED_USER_2_DISPLAY_NAME: process.env.AUTHORIZED_USER_2_DISPLAY_NAME,
    AUTHORIZED_USER_1_PIN_HASH: process.env.AUTHORIZED_USER_1_PIN_HASH,
    AUTHORIZED_USER_2_PIN_HASH: process.env.AUTHORIZED_USER_2_PIN_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET,
    AUTH_PIN_MIN_LENGTH: process.env.AUTH_PIN_MIN_LENGTH,
    AUTH_SESSION_DAYS: process.env.AUTH_SESSION_DAYS,
    MAX_IMAGE_BYTES: process.env.MAX_IMAGE_BYTES,
    MAX_VIDEO_BYTES: process.env.MAX_VIDEO_BYTES,
    MAX_AUDIO_BYTES: process.env.MAX_AUDIO_BYTES,
    MESSAGE_TEXT_MAX_LENGTH: process.env.MESSAGE_TEXT_MAX_LENGTH,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  });

  return cachedServerEnv;
}

export function parseServerEnv(input: Record<string, unknown>): ServerEnv {
  return serverEnvSchema.parse(input);
}

export function resetServerEnvCache() {
  cachedServerEnv = null;
}

export function encodePinHashForEnv(argon2Hash: string): string {
  return `base64:${Buffer.from(argon2Hash, "utf8").toString("base64")}`;
}
