import { describe, expect, it } from "vitest";

import { enqueueJob } from "../jobs.js";
import { getEnqueuedJobs } from "./helpers.js";

describe("jobs are reset properly", () => {
  it("part1", async () => {
    await enqueueJob("image.sweepUnconfirmed", {});
    expect(await getEnqueuedJobs("image.sweepUnconfirmed")).toHaveLength(1);
  });

  it("part2", async () => {
    expect(await getEnqueuedJobs("image.sweepUnconfirmed")).toHaveLength(0);
  });
});
