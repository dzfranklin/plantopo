import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "./env.js";
import { getLog } from "./logger.js";

export const db = drizzle(env.DATABASE_URL, {
  logger: {
    logQuery(query, params) {
      getLog().debug({ query, params }, "Database query");
    },
  },
});

export default db;
