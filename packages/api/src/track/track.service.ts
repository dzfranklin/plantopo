import { type RecordedTrack } from "@pt/shared";

import { getLog } from "../logger.js";

export async function uploadedRecordedTrack(payload: RecordedTrack) {
  getLog().info({ payload }, "uploadRecordedTrack");
}
