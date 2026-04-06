import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { user } from "../auth/auth.schema.js";
import { db } from "../db.js";

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

export async function ensureTestUser() {
  await db
    .insert(user)
    .values(TEST_USER)
    .onConflictDoUpdate({ target: user.id, set: TEST_USER });
}

export async function setupDb() {
  const dbUrl = process.env.DATABASE_URL!;
  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = "/postgres";

  const adminClient = new pg.Client(adminUrl.toString());
  await adminClient.connect();
  const { rows } = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (rows.length === 0) {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
  }
  await adminClient.end();

  const migrateDb = drizzle(dbUrl);
  await migrate(migrateDb, { migrationsFolder: "drizzle" });
  await migrateDb.$client.end();

  await ensureTestUser();
}
