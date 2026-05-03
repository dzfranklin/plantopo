import { eq } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Point2 } from "@pt/shared";

import db from "./db.js";
import { lineString } from "./postgis.js";

const table = pgTable("postgis_test_table", {
  id: text("id").primaryKey(),
  lineString: lineString("line_string"),
});

beforeAll(async () => {
  await db.execute(`DROP TABLE IF EXISTS postgis_test_table`);
  await db.execute(`
    CREATE TABLE postgis_test_table (
      id text PRIMARY KEY,
      line_string geometry(LineString,4326)
    )
  `);
});

beforeEach(async () => {
  await db.execute(`TRUNCATE TABLE postgis_test_table`);
});

describe("lineString", () => {
  it(`round-trips list`, async () => {
    const points: Point2[] = [
      [-122.4194, 37.7749],
      [-73.935242, 40.73061],
    ];

    await db.insert(table).values({
      id: "test",
      lineString: points,
    });

    const result = await db.select().from(table).where(eq(table.id, "test"));
    expect(result).toHaveLength(1);
    expect(result[0]!.lineString).toEqual(points);
  });

  it("round trips null", async () => {
    await db.insert(table).values({
      id: "test-null",
      lineString: null,
    });

    const result = await db
      .select()
      .from(table)
      .where(eq(table.id, "test-null"));
    expect(result).toHaveLength(1);
    expect(result[0]!.lineString).toBeNull();
  });
});
