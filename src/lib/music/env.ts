import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const musicEnvSchema = z.object({
  YOUTUBE_API_KEY: optionalSecret,
  SPOTIFY_CLIENT_ID: optionalSecret,
  SPOTIFY_CLIENT_SECRET: optionalSecret,
});

export type MusicEnv = z.infer<typeof musicEnvSchema>;

export function getMusicEnv(): MusicEnv {
  return musicEnvSchema.parse({
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  });
}

export function hasYouTubeSearch(): boolean {
  return Boolean(getMusicEnv().YOUTUBE_API_KEY);
}

export function hasSpotifyCredentials(): boolean {
  const env = getMusicEnv();
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
}
