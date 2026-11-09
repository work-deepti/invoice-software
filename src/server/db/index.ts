import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
/** Either the root db or a transaction handle. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

const globalForDb = globalThis as unknown as { __gsbPool?: Pool; __gsbDb?: DB };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
  return new Pool({
    connectionString: url,
    // Serverless: keep each function instance's pool small; use the provider's pooler URL.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    ssl: /sslmode=require|supabase\.co|neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
}

export function getDb(): DB {
  if (!globalForDb.__gsbDb) {
    globalForDb.__gsbPool = createPool();
    globalForDb.__gsbDb = drizzle(globalForDb.__gsbPool, { schema });
  }
  return globalForDb.__gsbDb;
}

/** Test hook: close the pool so the runner can exit. */
export async function closeDb(): Promise<void> {
  await globalForDb.__gsbPool?.end();
  globalForDb.__gsbPool = undefined;
  globalForDb.__gsbDb = undefined;
}
