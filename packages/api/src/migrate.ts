import "./loadEnv.js";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "./env.js";
import { logger } from "./logger.js";

logger.info("Connecting to database...");
const db = drizzle(env.DATABASE_URL);

const getApplied = () =>
  db.execute<{ hash: string }>(
    sql`SELECT hash FROM drizzle.__drizzle_migrations`,
  );

logger.info("Running migrations...");
const before = await getApplied().catch(() => ({ rows: [] }));
await migrate(db, { migrationsFolder: "drizzle" });
const after = await getApplied();
const applied = after.rows.filter(
  r => !before.rows.some(b => b.hash === r.hash),
);
if (applied.length > 0) {
  logger.info({ applied: applied.map(r => r.hash) }, "Migrations applied");
} else {
  logger.info("No new migrations");
}

await db.$client.end();
