import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { image } from "../image/image.schema.js";
import { track } from "./track.schema.js";

export const trackImage = pgTable(
  "track_image",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    imageS3Key: text("image_s3_key")
      .notNull()
      .references(() => image.s3Key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [primaryKey({ columns: [t.trackId, t.imageS3Key] })],
);

export const trackImageRelations = relations(trackImage, ({ one }) => ({
  track: one(track, {
    fields: [trackImage.trackId],
    references: [track.id],
  }),
  image: one(image, {
    fields: [trackImage.imageS3Key],
    references: [image.s3Key],
  }),
}));

export const imageToTrackImagesRelation = relations(image, ({ many }) => ({
  trackImages: many(trackImage),
}));

export const trackToImagesRelation = relations(track, ({ many }) => ({
  trackImages: many(trackImage),
}));
