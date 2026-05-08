import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { session, user } from "../auth/auth.schema.js";
import { db } from "../db.js";
import { track } from "../track/track.schema.js";

export const TEST_USER = {
  id: "test",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true as const,
  image: null,
  tileKey: "test-tile-key",
  eduAccess: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as const satisfies typeof user.$inferInsert;

export const TEST_USER2 = {
  ...TEST_USER,
  id: "test2",
  name: "Test2 User2",
  email: "test2@example.com",
  tileKey: "test2-tile-key",
} as const satisfies typeof user.$inferInsert;

export const TEST_SESSION = {
  session: {
    id: "test-session",
    userId: TEST_USER.id,
    token: "test-token",
    expiresAt: new Date(Date.now() + 86400_000),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ipAddress: null,
    userAgent: null,
  },
  user: TEST_USER,
} as const;

const TEST_SESSION_ROW: typeof session.$inferInsert = TEST_SESSION.session;

export const TEST_TRACK: typeof track.$inferInsert = {
  id: "test-track",
  userId: TEST_USER.id,
  name: "Test Track",
  startTime: new Date(0),
  endTime: new Date(1000),
  path: [
    [0, 0],
    [1, 1],
  ],
  pointTimestamps: [0, 1000],
};

export async function resetDb(client?: typeof db) {
  await truncateDb(client);
  await upsertFixtures(client);
}

async function truncateDb(client?: typeof db) {
  client ??= db;
  const { rows } = await client.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'spatial_ref_sys'`,
  );
  if (rows.length > 0) {
    const tables = rows.map(r => `"${r.tablename}"`).join(", ");
    await client.execute(sql.raw(`TRUNCATE TABLE ${tables} CASCADE`));
  }
}

async function upsertFixtures(client?: typeof db) {
  client ??= db;
  await client
    .insert(user)
    .values(TEST_USER)
    .onConflictDoUpdate({ target: user.id, set: TEST_USER });

  await client
    .insert(user)
    .values(TEST_USER2)
    .onConflictDoUpdate({ target: user.id, set: TEST_USER2 });

  await client
    .insert(session)
    .values(TEST_SESSION_ROW)
    .onConflictDoUpdate({ target: session.id, set: TEST_SESSION_ROW });

  await client
    .insert(track)
    .values(TEST_TRACK)
    .onConflictDoUpdate({ target: track.id, set: TEST_TRACK });
}

export async function setupDb(databaseUrl: string) {
  const client = drizzle(databaseUrl);
  await truncateDb(client);
  await migrate(client, { migrationsFolder: "../../drizzle" });
  await upsertFixtures(client);
  await client.$client.end();
}
