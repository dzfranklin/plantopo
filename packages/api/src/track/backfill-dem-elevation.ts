import { isNull } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../logger.js";
import { recordedTrack } from "./track.schema.js";
import { enqueuePopulateDemElevationJob } from "./track.service.js";

export default async function backfillDemElevation() {
  const rows = await db
    .select({ id: recordedTrack.id })
    .from(recordedTrack)
    .where(isNull(recordedTrack.pointDemElevation));

  logger.info({ count: rows.length }, "Enqueueing backfill jobs");

  for (const { id } of rows) {
    await enqueuePopulateDemElevationJob(id);
  }

  logger.info("Done");
}
