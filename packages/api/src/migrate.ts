import "./loadEnv.js";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "./env.js";
import { logger } from "./logger.js";

const db = drizzle(env.DATABASE_URL);

logger.info("Running migrations...");
await migrate(db, { migrationsFolder: "drizzle" });
logger.info("Migrations complete");

await db.$client.end();
