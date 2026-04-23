import archiver from "archiver";
import { eq } from "drizzle-orm";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { user } from "../auth/auth.schema.js";
import db from "../db.js";
import { recordedTrack } from "../track/track.schema.js";

interface Run {
  userId: string;
  scratch: string;
}

export async function generateExport(userId: string) {
  const id = "plantopo-export-" + userId + "-" + Date.now();

  const scratch = path.join(os.tmpdir(), id);
  await fs.mkdir(scratch); // fail if exists

  const run: Run = { userId, scratch };

  await exportUserTable(run);
  await exportRecordedTrackTable(run);

  const zipPath = path.join(os.tmpdir(), id + ".zip");
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip");
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(scratch, id);
    archive.finalize();
  });

  await fs.rm(scratch, { recursive: true });

  return id;
}

async function exportUserTable({ userId, scratch }: Run) {
  const row = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      prefs: user.prefs,
      eduAccess: user.eduAccess,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
    .then(rows => rows[0]);

  await fs.writeFile(
    path.join(scratch, "user.json"),
    JSON.stringify(row, null, 2),
  );
}

async function exportRecordedTrackTable({ scratch, userId }: Run) {
  const outDir = path.join(scratch, "recorded_track");
  await fs.mkdir(outDir);

  const list = await db
    .select({ id: recordedTrack.id })
    .from(recordedTrack)
    .where(eq(recordedTrack.userId, userId));

  for (const { id } of list) {
    const row = await db
      .select()
      .from(recordedTrack)
      .where(eq(recordedTrack.id, id))
      .then(rows => rows[0]);

    await fs.writeFile(
      path.join(outDir, `recorded_track_${id}.json`),
      JSON.stringify(row, null, 2),
    );
  }
}
