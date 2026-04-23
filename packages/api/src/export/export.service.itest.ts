import { execFileSync } from "child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

import { TEST_USER } from "../test/setupDb.js";
import { generateExport } from "./export.service.js";

it("generates zip with expected files", async () => {
  const id = await generateExport(TEST_USER.id);
  const result = path.join(os.tmpdir(), id + ".zip");
  const listing = execFileSync("unzip", ["-l", result], {
    encoding: "utf8",
  });

  expect(listing).toMatch(/\/user.json/);
  expect(listing).toMatch(/\/recorded_track\/recorded_track_test-track.json/);

  await fs.rm(result);
});
