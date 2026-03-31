import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "./env.js";
import { logger } from "./logger.js";

const dbLog = logger.child({ module: "db" });

export const db = drizzle(env.DATABASE_URL, {
  logger: {
    logQuery(query, params) {
      dbLog.debug({ params }, query);
    },
  },
});
