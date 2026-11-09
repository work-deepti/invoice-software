import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
/** Either the root db or a transaction handle. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

const globalForDb = globalThis as unknown as { __gsbPool?: Pool; __gsbDb?: DB };

function isLocalhost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1|::1/.test(urlStr);
  }
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
  const isLocal = isLocalhost(url);
  return new Pool({
    connectionString: url,
    // Serverless (Supabase transaction pooler on port 6543):
    // Keep per-instance pool small (1-3) to avoid exhausting pooler backend slots across lambdas.
    max: Number(process.env.DATABASE_POOL_MAX ?? 2),
    idleTimeoutMillis: 10_000,
    // Enable SSL for all non-localhost URLs (Supabase, Neon, etc.); localhost dev stays unencrypted.
    ssl: !isLocal || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
}

export function getDb(): DB {
  if (!globalForDb.__gsbDb) {
    globalForDb.__gsbPool = createPool();
    // pg (node-postgres) executes queries unnamed by default (extended query protocol without statement name),
    // which is fully compatible with PgBouncer transaction mode.
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
