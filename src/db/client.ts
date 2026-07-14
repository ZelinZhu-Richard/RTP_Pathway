import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// Single chokepoint for all database access. If better-sqlite3 ever becomes
// unavailable, this is the only file that needs to change (node:sqlite's
// DatabaseSync is a drop-in for the usage here).

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "rtp.db");

declare global {
  // eslint-disable-next-line no-var
  var __rtpDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  // WAL + busy_timeout so `next dev` and the Python pipeline can coexist.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// Reuse across HMR reloads in dev to avoid piling up connections.
export const db = globalThis.__rtpDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__rtpDb = db;

export * as schema from "./schema";
