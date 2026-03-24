import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { env } from "./env.js";

const db = drizzle(env.DATABASE_URL);

await migrate(db, { migrationsFolder: "drizzle" });
console.log("Migrations complete");

await db.$client.end();
