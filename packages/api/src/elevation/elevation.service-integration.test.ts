import { expect, it } from "vitest";

import type { Point2 } from "@pt/shared";

import { exportedForTesting, getElevations } from "./elevation.service.js";

// The worker inherits process.env at fork time
// This cache dir contains the tile covering Ben Nevis.
process.env.TILE_CACHE_DIR = import.meta.dirname + "/test-fixtures/tile-cache";

const BEN_NEVIS: Point2 = [-5.0035, 56.7969];

it("integration test getElevations", async () => {
  const result = await getElevations([BEN_NEVIS], []);
  expect(result.data[0]).not.toBeNull();
  expect(result.data[0]!).toBeGreaterThan(1100);
  expect(result.data[0]!).toBeLessThanOrEqual(1345);

  const bulkResult = Promise.all(
    new Array(100).fill(0).map(() => getElevations([BEN_NEVIS], [])),
  );

  const ac = new AbortController();
  const cancelledResult = getElevations([BEN_NEVIS], [], {
    signal: ac.signal,
  });

  ac.abort();

  await expect(cancelledResult).rejects.toThrow("aborted");
  await expect(bulkResult).resolves.toHaveLength(100);

  const killedResult = getElevations([BEN_NEVIS], []);

  exportedForTesting.getChild()!.kill();

  await expect(killedResult).rejects.toThrow("exited");

  const afterKillResult = await getElevations([BEN_NEVIS], []);
  expect(afterKillResult.data).toHaveLength(1);
});
