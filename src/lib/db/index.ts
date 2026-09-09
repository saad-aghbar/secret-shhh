import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Lazy DB client — only connects when first used.
 * Phase 0 UI does not query the database at build time.
 */
let pool: Pool | null = null;

function isLoopbackDatabaseUrl(connectionString: string) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use the database");
    }
    const onVercel = Boolean(process.env.VERCEL);
    pool = new Pool({
      connectionString,
      max: onVercel ? 1 : 10,
      idleTimeoutMillis: onVercel ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: isLoopbackDatabaseUrl(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof getDb>;
