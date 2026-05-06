import "../env/load.js";

import { beforeEach } from "vitest";

import { clearEnqueuedJobs } from "./helpers.js";
import { resetDb, resetRedis } from "./setup-db.js";

beforeEach(async () => {
  await Promise.all([resetDb(), resetRedis()]);
  clearEnqueuedJobs();
});
