import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { image } from "../image/image.schema.js";
import { recordedTrack } from "./track.schema.js";

export const recordedTrackImage = pgTable(
  "recorded_track_image",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => recordedTrack.id, { onDelete: "cascade" }),
    imageS3Key: text("image_s3_key")
      .notNull()
      .references(() => image.s3Key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [primaryKey({ columns: [t.trackId, t.imageS3Key] })],
);

export const recordedTrackImageRelations = relations(
  recordedTrackImage,
  ({ one }) => ({
    track: one(recordedTrack, {
      fields: [recordedTrackImage.trackId],
      references: [recordedTrack.id],
    }),
    image: one(image, {
      fields: [recordedTrackImage.imageS3Key],
      references: [image.s3Key],
    }),
  }),
);

export const imageToRecordedTrackImagesRelation = relations(
  image,
  ({ many }) => ({
    recordedTrackImages: many(recordedTrackImage),
  }),
);

export const recordedTrackToImagesRelation = relations(
  recordedTrack,
  ({ many }) => ({
    recordedTrackImages: many(recordedTrackImage),
  }),
);
