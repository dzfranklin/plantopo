import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { user } from "../auth/auth.schema.js";
import { point } from "../postgis.js";

export const image = pgTable(
  "image",
  {
    s3Key: text("s3_key").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sha256: text("sha256").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    uploaded: boolean("uploaded").notNull().default(false),
    takenAt: text("taken_at"),
    location: point("location"),
    exif: jsonb("exif"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [unique("image_user_sha256").on(t.userId, t.sha256)],
);

export const imageRelations = relations(image, ({ one }) => ({
  user: one(user, {
    fields: [image.userId],
    references: [user.id],
  }),
}));
