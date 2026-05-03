import { isNull } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../logger.js";
import { recordedTrack } from "./track.schema.js";
import { enqueuePopulatePreviewImagesJob } from "./track.service.js";

export default async function backfillPreviewImages() {
  const rows = await db
    .select({ id: recordedTrack.id })
    .from(recordedTrack)
    .where(isNull(recordedTrack.previewLargeSrc));

  logger.info({ count: rows.length }, "Enqueueing preview image backfill jobs");

  for (const { id } of rows) {
    await enqueuePopulatePreviewImagesJob(id);
  }

  logger.info("Done");
}
