import "../env/load.js";

import { beforeEach } from "vitest";

import { clearEnqueuedJobs } from "./helpers.js";
import { resetDb } from "./setup-db.js";

beforeEach(async () => {
  await resetDb();
  clearEnqueuedJobs();
});
