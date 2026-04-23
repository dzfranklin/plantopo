import { relations } from "drizzle-orm";
import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../auth/auth.schema.js";
import { lineString } from "../postgis.js";

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
  pointGpsElevation: doublePrecision("point_gps_elevation").array(), // NULL = device lacks GPS elevation
  pointHorizontalAccuracy: doublePrecision("point_horizontal_accuracy").array(),
  pointVerticalAccuracy: doublePrecision("point_vertical_accuracy").array(),
  pointSpeed: doublePrecision("point_speed").array(),
  pointSpeedAccuracy: doublePrecision("point_speed_accuracy").array(),
  pointBearing: doublePrecision("point_bearing").array(),
  pointBearingAccuracy: doublePrecision("point_bearing_accuracy").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // dtmElevation will be added in a future task (background DTM elevation fill job)
});

export const recordedTrackRelations = relations(recordedTrack, ({ one }) => ({
  user: one(user, {
    fields: [recordedTrack.userId],
    references: [user.id],
  }),
}));
