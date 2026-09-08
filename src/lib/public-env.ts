import { z } from "zod";

import { isCanonicalProductionUrl, isDeployedProduction } from "@/lib/env/runtime";

/**
 * Browser-safe env. Never import server secrets from this module.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .superRefine((value, ctx) => {
      if (!isDeployedProduction()) return;
      if (!isCanonicalProductionUrl(value)) {
        ctx.addIssue({
          code: "custom",
          message: "NEXT_PUBLIC_APP_URL must be a public https URL in production",
        });
      }
    }),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Shhh"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(input: Record<string, unknown>): PublicEnv {
  return publicEnvSchema.parse(input);
}

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
