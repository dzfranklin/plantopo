import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

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

  const db = drizzle(dbUrl);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.$client.end();
}
