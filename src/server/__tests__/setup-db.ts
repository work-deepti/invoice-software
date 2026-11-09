/**
 * Integration tests run against a real PostgreSQL given by TEST_DATABASE_URL.
 * The database is wiped and migrated from scratch once per test file.
 * Without TEST_DATABASE_URL the integration suites are skipped.
 */
import { afterAll, beforeAll } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  // Safety: these tests DROP the whole schema. Refuse anything that isn't clearly a test database.
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) throw new Error(`TEST_DATABASE_URL database "${dbName}" must contain "test" — refusing to wipe it.`);
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url)
    throw new Error("TEST_DATABASE_URL must not be the same database as DATABASE_URL.");

  process.env.DATABASE_URL = url;
  process.env.AUTH_SECRET ??= "integration-test-secret-0123456789";
  process.env.DATABASE_POOL_MAX ??= "12";

  beforeAll(async () => {
    const { Client, Pool } = await import("pg");
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    await c.end();
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    await pool.end();
  });

  afterAll(async () => {
    const { closeDb } = await import("../db");
    await closeDb();
  });
}
