import "../loadEnv.js";

import { beforeEach } from "vitest";

import { clearEnqueuedJobs } from "./helpers.js";
import { resetDb } from "./setupDb.js";

beforeEach(async () => {
  await resetDb();
  clearEnqueuedJobs();
});
