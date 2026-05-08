import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "./env.js";
import { getLog } from "./logger.js";

export const db = drizzle(env.DATABASE_URL, {
  logger: {
    logQuery(query, _params) {
      const { text, from } = parseQueryForLogging(query);
      getLog().debug({ query: text, "query.from": from }, "Database query");
    },
  },
});

interface QueryLoggingInfo {
  text: string;
  from?: string;
}

const FROM_RE = /from "?([^" ]+)/i;

function parseQueryForLogging(query: string): QueryLoggingInfo {
  const fromMatch = query.match(FROM_RE);
  const from = fromMatch ? fromMatch[1] : undefined;
  return { text: query, from };
}

export default db;
