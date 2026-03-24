import { beforeEach } from "vitest";

import { counterTable } from "../counter/counter.schema.js";
import { db } from "../db.js";

beforeEach(async () => {
  await db.delete(counterTable);
});
