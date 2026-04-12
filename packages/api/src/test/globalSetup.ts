import "../loadEnv.js";

import { db } from "../db.js";
import { setupDb } from "./setupDb.js";

export async function setup() {
  await setupDb();
}

export async function teardown() {
  await db.$client.end();
}
