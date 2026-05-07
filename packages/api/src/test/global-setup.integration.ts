import "../env/load.js";

import { db } from "../db.js";
import { setupDb } from "./setup-db.js";

export async function setup() {
  await setupDb();
}

export async function teardown() {
  await db.$client.end();
}
