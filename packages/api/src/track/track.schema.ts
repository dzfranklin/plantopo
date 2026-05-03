import { relations } from "drizzle-orm";
import {
  customType,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
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

export const recordedTrack = pgTable("recorded_track", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  path: lineString("path").notNull(),
  pointTimestamps: doublePrecision("point_timestamps").array().notNull(),
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
  pointBearingAccuracy: nullableDoublePrecisionArray("point_bearing_accuracy"),
  pointDemElevation: nullableDoublePrecisionArray("point_dem_elevation"), // NULL = not yet populated
  previewLargeSrc: bytea("preview_large_src"),
  previewLargeWidth: integer("preview_large_width"),
  previewLargeHeight: integer("preview_large_height"),
  previewSmallSrc: bytea("preview_small_src"),
  previewSmallWidth: integer("preview_small_width"),
  previewSmallHeight: integer("preview_small_height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recordedTrackRelations = relations(recordedTrack, ({ one }) => ({
  user: one(user, {
    fields: [recordedTrack.userId],
    references: [user.id],
  }),
}));
