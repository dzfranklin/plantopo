import { relations, sql } from "drizzle-orm";
import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth/auth.schema.js";
import { lineString } from "../postgis.js";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// double precision[] where individual elements may be NULL
const nullableDoublePrecisionArray = customType<{
  data: (number | null)[] | null;
  driverData: string;
}>({
  dataType: () => "double precision[]",
});

export const recordedTrack = pgTable(
  "recorded_track",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    name: text("name"),
    description: text("description"),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    path: lineString("path").notNull(),
    pointTimestamps: nullableDoublePrecisionArray("point_timestamps"),
    pointGpsElevation: nullableDoublePrecisionArray("point_gps_elevation"), // NULL = device lacks GPS elevation
    pointHorizontalAccuracy: nullableDoublePrecisionArray(
      "point_horizontal_accuracy",
    ),
    pointVerticalAccuracy: nullableDoublePrecisionArray(
      "point_vertical_accuracy",
    ),
    pointSpeed: nullableDoublePrecisionArray("point_speed"),
    pointSpeedAccuracy: nullableDoublePrecisionArray("point_speed_accuracy"),
    pointBearing: nullableDoublePrecisionArray("point_bearing"),
    pointBearingAccuracy: nullableDoublePrecisionArray(
      "point_bearing_accuracy",
    ),
    pointDemElevation: nullableDoublePrecisionArray("point_dem_elevation"), // NULL = not yet populated
    previewLargeSrc: bytea("preview_large_src"),
    previewLargeWidth: integer("preview_large_width"),
    previewLargeHeight: integer("preview_large_height"),
    previewSmallSrc: bytea("preview_small_src"),
    previewSmallWidth: integer("preview_small_width"),
    previewSmallHeight: integer("preview_small_height"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("recorded_track_source_idx")
      .on(t.userId, t.sourceType, t.sourceId)
      .where(sql`${t.sourceType} IS NOT NULL`),
  ],
);

export const recordedTrackRelations = relations(recordedTrack, ({ one }) => ({
  user: one(user, {
    fields: [recordedTrack.userId],
    references: [user.id],
  }),
}));
