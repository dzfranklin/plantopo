import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const TEST_DB_URL = process.env.DATABASE_URL!;

export async function setup() {
  // Parse the DB name from the URL to create it if it doesn't exist
  const url = new URL(TEST_DB_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(TEST_DB_URL);
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

  const db = drizzle(TEST_DB_URL);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.$client.end();
}
