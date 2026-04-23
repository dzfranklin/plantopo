import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { session, user } from "../auth/auth.schema.js";
import { db } from "../db.js";
import { recordedTrack } from "../track/track.schema.js";

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
} as const;

const checkTestUserType = (u: typeof user.$inferInsert) => u;
checkTestUserType(TEST_USER);

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

export const TEST_TRACK: typeof recordedTrack.$inferInsert = {
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

export async function resetDb() {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'spatial_ref_sys'`,
  );
  if (rows.length > 0) {
    const tables = rows.map(r => `"${r.tablename}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE TABLE ${tables} CASCADE`));
  }
  await upsertFixtures();
}

export async function upsertFixtures() {
  await db
    .insert(user)
    .values(TEST_USER)
    .onConflictDoUpdate({ target: user.id, set: TEST_USER });

  await db
    .insert(session)
    .values(TEST_SESSION_ROW)
    .onConflictDoUpdate({ target: session.id, set: TEST_SESSION_ROW });

  await db
    .insert(recordedTrack)
    .values(TEST_TRACK)
    .onConflictDoUpdate({ target: recordedTrack.id, set: TEST_TRACK });
}

export async function setupDb() {
  const dbUrl = process.env.DATABASE_URL!;
  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = "/postgres";

  const adminClient = new pg.Client(adminUrl.toString());
  await adminClient.connect();
  await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await adminClient.query(`CREATE DATABASE "${dbName}"`);
  await adminClient.end();

  const migrateDb = drizzle(dbUrl);
  await migrate(migrateDb, { migrationsFolder: "drizzle" });
  await migrateDb.$client.end();

  await upsertFixtures();
}
