import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../auth/auth.schema.js";

// Short-lived token stored during Strava OAuth flow to tie the callback back to a user.
export const stravaOauthState = pgTable("strava_oauth_state", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stravaConnection = pgTable("strava_connection", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  athleteId: text("athlete_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  scope: text("scope").notNull(),
  athlete: jsonb("athlete").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const stravaConnectionRelations = relations(
  stravaConnection,
  ({ one }) => ({
    user: one(user, {
      fields: [stravaConnection.userId],
      references: [user.id],
    }),
  }),
);
