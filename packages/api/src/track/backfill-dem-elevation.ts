import { isNull } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../logger.js";
import { track } from "./track.schema.js";
import { enqueuePopulateDemElevationJob } from "./track.service.js";

export default async function backfillDemElevation() {
  const rows = await db
    .select({ id: track.id })
    .from(track)
    .where(isNull(track.pointDemElevation));

  logger.info({ count: rows.length }, "Enqueueing backfill jobs");

  for (const { id } of rows) {
    await enqueuePopulateDemElevationJob(id);
  }

  logger.info("Done");
}
