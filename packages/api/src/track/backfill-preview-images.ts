import { isNull } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../logger.js";
import { track } from "./track.schema.js";
import {
  enqueuePopulatePreviewImagesJob,
  resetPopulatePreviewImagesJobs,
} from "./track.service.js";

export default async function backfillPreviewImages({
  resetExisting = false,
}: { resetExisting?: boolean } = {}) {
  const rows = await db
    .select({ id: track.id })
    .from(track)
    .where(isNull(track.previewLargeSrc));

  if (resetExisting) {
    logger.info("Removing existing preview image data");
    await resetPopulatePreviewImagesJobs();
  }

  logger.info({ count: rows.length }, "Enqueueing preview image backfill jobs");
  for (const { id } of rows) {
    await enqueuePopulatePreviewImagesJob(id);
  }

  logger.info("Done");
}
