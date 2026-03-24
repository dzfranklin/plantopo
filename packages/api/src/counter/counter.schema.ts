import { integer, pgTable } from "drizzle-orm/pg-core";

export const counterTable = pgTable("counter", {
  value: integer("value").notNull().default(0),
});
