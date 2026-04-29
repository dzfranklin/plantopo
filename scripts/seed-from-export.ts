import { eq } from "drizzle-orm";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { user } from "../packages/api/src/auth/auth.schema.js";
import db from "../packages/api/src/db.js";
import { recordedTrack } from "../packages/api/src/track/track.schema.js";

const [, , ...args] = process.argv;

if (args.length === 0) {
  console.error(
    "Usage: npm run db:seed-from-export -- user@example.com plantopo-export-foo.zip",
  );
  process.exit(1);
}
const targetEmail = args[0];
const exportPath = args[1];

const targetRows = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, targetEmail));
if (targetRows.length === 0) {
  console.error(`No user found with email ${targetEmail}`);
  process.exit(1);
}
const targetID = targetRows[0]!.id;

console.log(
  `Seeding recorded tracks for user ${targetEmail} (id ${targetID}) from export ${exportPath}`,
);

const exportDir = await fs.mkdtempDisposable(
  path.join(os.tmpdir(), "plantopo-export-"),
);
spawnSync("unzip", [exportPath, "-d", exportDir.path], { stdio: "inherit" });

const rootList = await fs.readdir(exportDir.path);
if (rootList.length !== 1) {
  console.error(
    `Expected exactly one root directory in export zip, found ${rootList.length}`,
  );
  process.exit(1);
}
const rootDir = path.join(exportDir.path, rootList[0]!);

const trackDir = path.join(rootDir, "recorded_track");
const trackFiles = await fs.readdir(trackDir);
for (const trackFile of trackFiles) {
  const raw = await fs.readFile(path.join(trackDir, trackFile), "utf-8");
  const data = JSON.parse(raw);

  data.userId = targetID;
  data.startTime = new Date(data.startTime);
  data.endTime = new Date(data.endTime);
  data.createdAt = new Date(data.createdAt);

  await db.insert(recordedTrack).values(data).onConflictDoUpdate({
    target: recordedTrack.id,
    set: data,
  });
  console.log(`Inserted track ${data.id} (${data.name})`);
}

await db.$client.end();
