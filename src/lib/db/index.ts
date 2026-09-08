import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Lazy DB client — only connects when first used.
 * Phase 0 UI does not query the database at build time.
 */
let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use the database");
    }
    pool = new Pool({ connectionString });
  }

  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof getDb>;
