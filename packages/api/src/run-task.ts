import "./loadEnv.js";

import { db } from "./db.js";
import { closeJobQueues } from "./jobs.js";
import { logger } from "./logger.js";

const task = process.argv[2];
if (!task) {
  logger.error("Usage: run-task <task>");
  process.exit(1);
}

switch (task) {
  case "track-backfill-dem-elevation": {
    await (await import("./track/backfill-dem-elevation.js")).default();
    break;
  }
  case "track-backfill-preview-images": {
    await (await import("./track/backfill-preview-images.js")).default();
    break;
  }
  default:
    logger.error({ task }, "Unknown task");
    process.exit(1);
}

await db.$client.end();
await closeJobQueues();
